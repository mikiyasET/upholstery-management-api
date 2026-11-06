import { AssetsService } from '../assets.service';
import prisma from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => {
  const mAsset = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };
  const mAssetLog = {
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      asset: mAsset,
      assetLog: mAssetLog,
      $transaction: jest.fn((cb: any) => cb({ asset: mAsset, assetLog: mAssetLog })),
    },
  };
});

describe('AssetsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAsset', () => {
    it('creates an asset and records an audit log', async () => {
      (prisma.asset.count as jest.Mock).mockResolvedValue(0);
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.asset.create as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        assetTag: 'AST-0001',
        nameEn: 'Drill Machine',
        nameAm: 'መሰርሰሪያ',
        quantity: 2,
        unit: 'PCS',
        isDeleted: false,
      });

      const result = await AssetsService.createAsset(
        {
          nameEn: 'Drill Machine',
          nameAm: 'መሰርሰሪያ',
          quantity: 2,
          unit: 'PCS',
        },
        'user-1'
      );

      expect(prisma.asset.create).toHaveBeenCalled();
      expect(prisma.assetLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-1',
            action: 'CREATE',
            changedById: 'user-1',
          }),
        })
      );
      expect(result.id).toBe('asset-1');
    });
  });

  describe('updateAsset', () => {
    it('updates asset and records diff in audit log', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        nameEn: 'Old Drill',
        nameAm: 'የድሮ መሰርሰሪያ',
        quantity: 2,
        unit: 'PCS',
        category: 'Tools',
        location: 'Shelf A',
        isDeleted: false,
      });

      (prisma.asset.update as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        nameEn: 'New Drill',
        quantity: 5,
      });

      await AssetsService.updateAsset(
        'asset-1',
        {
          nameEn: 'New Drill',
          quantity: 5,
          auditNote: 'Purchased 3 more',
        },
        'user-1'
      );

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({
            nameEn: 'New Drill',
            quantity: 5,
          }),
        })
      );

      expect(prisma.assetLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetId: 'asset-1',
          action: 'UPDATE',
          changedById: 'user-1',
          changes: {
            nameEn: { from: 'Old Drill', to: 'New Drill' },
            quantity: { from: 2, to: 5 },
          },
          notes: 'Purchased 3 more',
        }),
      });
    });

    it('rejects editing if asset is currently in trash', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        isDeleted: true,
      });

      await expect(
        AssetsService.updateAsset('asset-1', { nameEn: 'New Name' }, 'user-1')
      ).rejects.toThrow('Cannot edit an asset currently in Trash');
    });
  });

  describe('moveToTrash', () => {
    it('sets isDeleted=true, records TRASH log, and schedules 30-day purge', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        isDeleted: false,
      });

      (prisma.asset.update as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        isDeleted: true,
      });

      await AssetsService.moveToTrash('asset-1', 'user-1');

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: expect.objectContaining({
            isDeleted: true,
            deletedById: 'user-1',
            scheduledPurgeAt: expect.any(Date),
          }),
        })
      );

      expect(prisma.assetLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-1',
            action: 'TRASH',
            changedById: 'user-1',
          }),
        })
      );
    });
  });

  describe('permanentDelete', () => {
    it('blocks immediate deletion if 30-day retention has not elapsed', async () => {
      const futurePurge = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days in future
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        isDeleted: true,
        scheduledPurgeAt: futurePurge,
      });

      await expect(AssetsService.permanentDelete('asset-1')).rejects.toThrow(
        /Asset cannot be deleted instantly.*mandatory 30-day trash retention/
      );
      expect(prisma.asset.delete).not.toHaveBeenCalled();
    });

    it('permits deletion if 30-day purge date has passed', async () => {
      const pastPurge = new Date(Date.now() - 1000); // in the past
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        isDeleted: true,
        scheduledPurgeAt: pastPurge,
        imageUrl: null,
      });

      (prisma.asset.delete as jest.Mock).mockResolvedValue({ id: 'asset-1' });

      await AssetsService.permanentDelete('asset-1');
      expect(prisma.asset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
    });
  });

  describe('restoreFromTrash', () => {
    it('restores asset and records RESTORE log', async () => {
      (prisma.asset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        isDeleted: true,
      });

      (prisma.asset.update as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        isDeleted: false,
      });

      await AssetsService.restoreFromTrash('asset-1', 'user-1');

      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-1' },
          data: {
            isDeleted: false,
            deletedAt: null,
            scheduledPurgeAt: null,
            deletedById: null,
          },
        })
      );

      expect(prisma.assetLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-1',
            action: 'RESTORE',
            changedById: 'user-1',
          }),
        })
      );
    });
  });
});

