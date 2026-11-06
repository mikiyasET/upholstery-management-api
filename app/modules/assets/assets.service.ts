import fs from 'fs';
import path from 'path';
import prisma from '../../lib/prisma';

export class AssetsService {
  /**
   * Automatically purges assets whose 30-day retention period in trash has expired.
   */
  static async purgeExpiredTrash() {
    try {
      const now = new Date();
      const expiredAssets = await prisma.asset.findMany({
        where: {
          isDeleted: true,
          scheduledPurgeAt: { lte: now },
        },
        select: { id: true, imageUrl: true },
      });

      if (expiredAssets.length === 0) return 0;

      for (const asset of expiredAssets) {
        if (asset.imageUrl) {
          const uploadsDir = process.env.UPLOADS_DIR || './uploads';
          const filePath = path.resolve(uploadsDir, asset.imageUrl);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch {
              // Ignore disk removal errors
            }
          }
        }
      }

      const deleteResult = await prisma.asset.deleteMany({
        where: {
          id: { in: expiredAssets.map((a) => a.id) },
        },
      });

      return deleteResult.count;
    } catch (err) {
      console.error('Error during automatic trash purge:', err);
      return 0;
    }
  }

  /**
   * Generate an automated asset tag (e.g. AST-0001) if not provided by user.
   */
  static async generateAssetTag(): Promise<string> {
    const count = await prisma.asset.count();
    let num = count + 1;
    let candidate = `AST-${String(num).padStart(4, '0')}`;
    while (await prisma.asset.findUnique({ where: { assetTag: candidate } })) {
      num += 1;
      candidate = `AST-${String(num).padStart(4, '0')}`;
    }
    return candidate;
  }

  /**
   * Fetch assets with search and status filters (active, trash, all).
   */
  static async getAssets(query: {
    search?: string;
    category?: string;
    status?: 'active' | 'trash' | 'all';
  }) {
    // Proactively purge expired trash first
    await this.purgeExpiredTrash();

    const { search, category, status = 'active' } = query;
    const where: any = {};

    if (status === 'active') {
      where.isDeleted = false;
    } else if (status === 'trash') {
      where.isDeleted = true;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { nameEn: { contains: term, mode: 'insensitive' } },
        { nameAm: { contains: term } },
        { assetTag: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return prisma.asset.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        deletedBy: { select: { id: true, name: true, role: true } },
        _count: { select: { logs: true } },
      },
      orderBy: status === 'trash' ? { scheduledPurgeAt: 'asc' } : { createdAt: 'desc' },
    });
  }

  /**
   * Fetch a single asset with full historical audit logs.
   */
  static async getAssetById(id: string) {
    await this.purgeExpiredTrash();

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        deletedBy: { select: { id: true, name: true, role: true } },
        logs: {
          include: {
            changedBy: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    return asset;
  }

  /**
   * Get trash count and earliest purge summary.
   */
  static async getTrashSummary() {
    await this.purgeExpiredTrash();

    const trashCount = await prisma.asset.count({
      where: { isDeleted: true },
    });

    const nextPurgeAsset = await prisma.asset.findFirst({
      where: { isDeleted: true },
      orderBy: { scheduledPurgeAt: 'asc' },
      select: { scheduledPurgeAt: true },
    });

    return {
      trashCount,
      earliestPurgeAt: nextPurgeAsset?.scheduledPurgeAt || null,
    };
  }

  /**
   * Create a new company asset.
   */
  static async createAsset(data: any, userId: string, imagePath?: string) {
    const assetTag = data.assetTag || (await this.generateAssetTag());

    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          assetTag,
          nameEn: data.nameEn,
          nameAm: data.nameAm,
          description: data.description || null,
          quantity: data.quantity ?? 1,
          unit: data.unit || 'PCS',
          category: data.category || null,
          location: data.location || null,
          imageUrl: imagePath || null,
          createdById: userId,
          isDeleted: false,
        },
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
        },
      });

      // Record CREATE audit log
      await tx.assetLog.create({
        data: {
          assetId: asset.id,
          action: 'CREATE',
          changedById: userId,
          changes: {
            assetTag: { to: asset.assetTag },
            nameEn: { to: asset.nameEn },
            nameAm: { to: asset.nameAm },
            quantity: { to: asset.quantity },
            unit: { to: asset.unit },
            category: { to: asset.category },
            location: { to: asset.location },
          },
          notes: 'Asset registered in system',
        },
      });

      return asset;
    });
  }

  /**
   * Update an existing asset and record detailed audit diff.
   */
  static async updateAsset(id: string, data: any, userId: string, imagePath?: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Asset not found');
    }

    if (existing.isDeleted) {
      throw new Error('Cannot edit an asset currently in Trash. Please restore it first.');
    }

    const updatePayload: any = {};
    const diff: Record<string, { from: any; to: any }> = {};

    const fieldsToTrack = [
      'nameEn',
      'nameAm',
      'description',
      'quantity',
      'unit',
      'category',
      'location',
      'assetTag',
    ] as const;

    for (const field of fieldsToTrack) {
      if (data[field] !== undefined) {
        let oldVal: any = (existing as any)[field];
        let newVal: any = data[field];

        if (field === 'quantity') {
          oldVal = Number(oldVal);
          newVal = Number(newVal);
        }

        if (oldVal !== newVal) {
          diff[field] = { from: oldVal, to: newVal };
          updatePayload[field] = data[field];
        }
      }
    }

    if (imagePath && imagePath !== existing.imageUrl) {
      diff['imageUrl'] = { from: existing.imageUrl || null, to: imagePath };
      updatePayload.imageUrl = imagePath;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.asset.update({
        where: { id },
        data: updatePayload,
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
          deletedBy: { select: { id: true, name: true, role: true } },
        },
      });

      // Record UPDATE audit log only if changes were made or note provided
      if (Object.keys(diff).length > 0 || data.auditNote) {
        await tx.assetLog.create({
          data: {
            assetId: id,
            action: 'UPDATE',
            changedById: userId,
            changes: Object.keys(diff).length > 0 ? diff : undefined,
            notes: data.auditNote || 'Asset information updated',
          },
        });
      }

      return updated;
    });
  }

  /**
   * Move asset to 30-day trash retention bin.
   * Can not be deleted instantly.
   */
  static async moveToTrash(id: string, userId: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Asset not found');
    }

    if (existing.isDeleted) {
      throw new Error('Asset is already in Trash');
    }

    const deletedAt = new Date();
    // 30 days retention: 30 * 24 * 60 * 60 * 1000 ms
    const scheduledPurgeAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      const trashed = await tx.asset.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt,
          scheduledPurgeAt,
          deletedById: userId,
        },
      });

      await tx.assetLog.create({
        data: {
          assetId: id,
          action: 'TRASH',
          changedById: userId,
          changes: {
            status: { from: 'ACTIVE', to: 'TRASH' },
            scheduledPurgeAt: { to: scheduledPurgeAt.toISOString() },
          },
          notes: 'Moved to 30-day retention trash bin',
        },
      });

      return trashed;
    });
  }

  /**
   * Restore an asset from trash back to active inventory.
   */
  static async restoreFromTrash(id: string, userId: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Asset not found');
    }

    if (!existing.isDeleted) {
      throw new Error('Asset is not in Trash');
    }

    return prisma.$transaction(async (tx) => {
      const restored = await tx.asset.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
          scheduledPurgeAt: null,
          deletedById: null,
        },
      });

      await tx.assetLog.create({
        data: {
          assetId: id,
          action: 'RESTORE',
          changedById: userId,
          changes: {
            status: { from: 'TRASH', to: 'ACTIVE' },
          },
          notes: 'Restored from trash bin back to active inventory',
        },
      });

      return restored;
    });
  }

  /**
   * Permanent deletion guard.
   * As required: cannot delete instantly before 30 days have elapsed.
   */
  static async permanentDelete(id: string) {
    const existing = await prisma.asset.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Asset not found');
    }

    const now = new Date();
    if (existing.scheduledPurgeAt && existing.scheduledPurgeAt > now) {
      const daysLeft = Math.ceil((existing.scheduledPurgeAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      throw new Error(
        `Asset cannot be deleted instantly. It is protected by mandatory 30-day trash retention (${daysLeft} ${
          daysLeft === 1 ? 'day' : 'days'
        } remaining before automatic purge).`
      );
    }

    // Clean image
    if (existing.imageUrl) {
      const uploadsDir = process.env.UPLOADS_DIR || './uploads';
      const filePath = path.resolve(uploadsDir, existing.imageUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {}
      }
    }

    return prisma.asset.delete({ where: { id } });
  }
}
