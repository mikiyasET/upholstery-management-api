import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import { AuditAction } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { validateQuantityForUnit } from '../../lib/units';

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

function deleteFileIfExists(filePath: string | null | undefined) {
  if (!filePath) return;
  const fullPath = path.resolve(process.cwd(), UPLOADS_DIR, filePath);
  if (fs.existsSync(fullPath)) {
    try { fs.unlinkSync(fullPath); } catch (e) { console.error('Error deleting file:', e); }
  }
}

export class CatalogService {
  static async generateItemCode(): Promise<string> {
    const count = await prisma.material.count();
    let num = count + 1;
    let candidate = `MAT-${String(num).padStart(4, '0')}`;
    while (await prisma.material.findUnique({ where: { itemCode: candidate } })) {
      num++;
      candidate = `MAT-${String(num).padStart(4, '0')}`;
    }
    return candidate;
  }

  // ==========================================
  // Materials
  // ==========================================
  static async getMaterials(filter?: { itemCode?: string; search?: string }) {
    const where: any = { isActive: true };
    if (filter?.itemCode) {
      where.itemCode = filter.itemCode.trim();
    } else if (filter?.search) {
      const q = filter.search.trim();
      where.OR = [
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameAm: { contains: q } },
        { itemCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.material.findMany({ 
      where,
      include: {
        materialStocks: { include: { store: true } },
        brands: {
          include: {
            brandStocks: { include: { store: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getMaterial(idOrCode: string) {
    return prisma.material.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { itemCode: idOrCode },
        ],
      },
      include: {
        materialStocks: { include: { store: true } },
        brands: {
          include: {
            brandStocks: { include: { store: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  static async getMaterialByCode(itemCode: string) {
    return prisma.material.findUnique({
      where: { itemCode },
      include: {
        materialStocks: { include: { store: true } },
        brands: {
          include: {
            brandStocks: { include: { store: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  static async createMaterial(data: any, userId: string, imagePath?: string) {
    let itemCode = data.itemCode ? String(data.itemCode).trim() : '';
    if (itemCode) {
      const existing = await prisma.material.findUnique({ where: { itemCode } });
      if (existing) {
        throw new Error(`Item code "${itemCode}" is already in use`);
      }
    } else {
      itemCode = await this.generateItemCode();
    }

    const { brands, ...materialFields } = data;
    if (materialFields.lowStockThreshold !== undefined) {
      validateQuantityForUnit(materialFields.lowStockThreshold, materialFields.unit, 'Low stock threshold');
    }

    // If brands are provided and currentPrice is missing, fallback to first brand price
    let currentPrice = materialFields.currentPrice;
    if ((currentPrice === undefined || currentPrice === null) && Array.isArray(brands) && brands.length > 0) {
      currentPrice = brands[0].price;
    }

    return prisma.$transaction(async (tx) => {
      const material = await tx.material.create({
        data: {
          ...materialFields,
          currentPrice,
          itemCode,
          imageUrl: imagePath,
        },
      });

      if (Array.isArray(brands) && brands.length > 0) {
        for (const b of brands) {
          const trimmedSize = b.size && String(b.size).trim() ? String(b.size).trim() : null;
          const trimmedColor = b.color && String(b.color).trim() ? String(b.color).trim() : null;
          const trimmedType = b.type && String(b.type).trim() ? String(b.type).trim() : null;
          await tx.materialBrand.create({
            data: {
              materialId: material.id,
              name: b.name.trim(),
              size: trimmedSize,
              color: trimmedColor,
              type: trimmedType,
              price: b.price,
            },
          });

          await tx.priceHistory.create({
            data: {
              materialId: material.id,
              brandName: b.name.trim(),
              sizeName: trimmedSize,
              colorName: trimmedColor,
              typeName: trimmedType,
              price: b.price,
              changedById: userId,
            },
          });
        }
      } else if (material.currentPrice) {
        await tx.priceHistory.create({
          data: {
            materialId: material.id,
            price: material.currentPrice,
            changedById: userId,
          },
        });
      }

      await AuditService.record('Material', material.id, AuditAction.CREATE, userId, null, material);

      const full = await tx.material.findUnique({
        where: { id: material.id },
        include: {
          materialStocks: { include: { store: true } },
          brands: {
            include: {
              brandStocks: { include: { store: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      return full || material;
    });
  }

  static async updateMaterial(id: string, data: any, userId: string, imagePath?: string) {
    const old = await prisma.material.findFirst({
      where: {
        OR: [
          { id },
          { itemCode: id },
        ],
      },
      include: { brands: true },
    });
    if (!old) throw new Error('Material not found');

    const { brands, ...rawUpdateData } = data;
    const updateData = { ...rawUpdateData };
    if (imagePath) updateData.imageUrl = imagePath;

    const unitToCheck = updateData.unit || old.unit;
    if (updateData.lowStockThreshold !== undefined) {
      validateQuantityForUnit(updateData.lowStockThreshold, unitToCheck, 'Low stock threshold');
    }

    if (updateData.itemCode !== undefined) {
      const trimmedCode = String(updateData.itemCode).trim();
      if (!trimmedCode) {
        delete updateData.itemCode;
      } else if (trimmedCode !== old.itemCode) {
        const conflict = await prisma.material.findFirst({
          where: {
            itemCode: trimmedCode,
            id: { not: old.id },
          },
        });
        if (conflict) {
          throw new Error(`Item code "${trimmedCode}" is already in use by another material`);
        }
        updateData.itemCode = trimmedCode;
      }
    }

    if (Array.isArray(brands) && brands.length > 0 && updateData.currentPrice === undefined) {
      updateData.currentPrice = brands[0].price;
    }

    return prisma.$transaction(async (tx) => {
      const material = await tx.material.update({
        where: { id: old.id },
        data: updateData,
      });

      if (brands !== undefined) {
        if (Array.isArray(brands) && brands.length > 0) {
          const newBrandKeys = brands.map((b: any) => {
            const s = (b.size && String(b.size).trim()) || '';
            const c = (b.color && String(b.color).trim()) || '';
            const t = (b.type && String(b.type).trim()) || '';
            return `${b.name.trim().toLowerCase()}:::${s.toLowerCase()}:::${c.toLowerCase()}:::${t.toLowerCase()}`;
          });
          const newBrandIds = brands.filter((b: any) => b.id).map((b: any) => b.id);

          // Delete brands/variations that are no longer in the list
          const brandsToDelete = (old.brands || []).filter((ob: any) => {
            if (newBrandIds.includes(ob.id)) return false;
            const obKey = `${ob.name.trim().toLowerCase()}:::${(ob.size || '').trim().toLowerCase()}:::${(ob.color || '').trim().toLowerCase()}:::${(ob.type || '').trim().toLowerCase()}`;
            return !newBrandKeys.includes(obKey);
          });
          if (brandsToDelete.length > 0) {
            await tx.materialBrand.deleteMany({
              where: { id: { in: brandsToDelete.map((b: any) => b.id) } },
            });
          }

          for (const b of brands) {
            const trimmedName = b.name.trim();
            const trimmedSize = b.size && String(b.size).trim() ? String(b.size).trim() : null;
            const trimmedColor = b.color && String(b.color).trim() ? String(b.color).trim() : null;
            const trimmedType = b.type && String(b.type).trim() ? String(b.type).trim() : null;
            const bKey = `${trimmedName.toLowerCase()}:::${(trimmedSize || '').toLowerCase()}:::${(trimmedColor || '').toLowerCase()}:::${(trimmedType || '').toLowerCase()}`;

            const existingBrand = (old.brands || []).find((ob: any) => {
              if (b.id && ob.id === b.id) return true;
              const obKey = `${ob.name.trim().toLowerCase()}:::${(ob.size || '').trim().toLowerCase()}:::${(ob.color || '').trim().toLowerCase()}:::${(ob.type || '').trim().toLowerCase()}`;
              return obKey === bKey;
            });

            if (existingBrand) {
              await tx.materialBrand.update({
                where: { id: existingBrand.id },
                data: {
                  name: trimmedName,
                  size: trimmedSize,
                  color: trimmedColor,
                  type: trimmedType,
                  price: b.price,
                },
              });
            } else {
              await tx.materialBrand.create({
                data: {
                  materialId: old.id,
                  name: trimmedName,
                  size: trimmedSize,
                  color: trimmedColor,
                  type: trimmedType,
                  price: b.price,
                },
              });
            }

            // Check if price changed or new
            if (!existingBrand || Number(existingBrand.price) !== Number(b.price)) {
              await tx.priceHistory.create({
                data: {
                  materialId: old.id,
                  brandName: trimmedName,
                  sizeName: trimmedSize,
                  colorName: trimmedColor,
                  typeName: trimmedType,
                  price: b.price,
                  changedById: userId,
                },
              });
            }
          }
        } else {
          // If brands array is empty (user disabled multiple brands), delete all brands
          await tx.materialBrand.deleteMany({ where: { materialId: old.id } });
        }
      }

      if (updateData.currentPrice !== undefined && updateData.currentPrice !== Number(old.currentPrice)) {
        await tx.priceHistory.create({
          data: {
            materialId: material.id,
            price: updateData.currentPrice,
            changedById: userId,
          },
        });
      }

      await AuditService.record('Material', material.id, AuditAction.UPDATE, userId, old, material);

      const full = await tx.material.findUnique({
        where: { id: material.id },
        include: {
          materialStocks: { include: { store: true } },
          brands: {
            include: {
              brandStocks: { include: { store: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      return full || material;
    });
  }

  static async deleteMaterial(idOrCode: string, userId: string) {
    const old = await prisma.material.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { itemCode: idOrCode },
        ],
      },
    });
    if (!old) throw new Error('Material not found');

    const material = await prisma.material.update({
      where: { id: old.id },
      data: { isActive: false },
    });
    await AuditService.record('Material', old.id, AuditAction.DELETE, userId, null, null);
    return material;
  }

  // ==========================================
  // Services & Categories
  // ==========================================
  static async getServiceGroups() {
    return prisma.serviceGroup.findMany({
      include: {
        _count: {
          select: { services: { where: { isActive: true } } },
        },
      },
      orderBy: { nameEn: 'asc' },
    });
  }

  static async createServiceGroup(data: any) {
    return prisma.serviceGroup.create({ data });
  }

  static async updateServiceGroup(id: string, data: any) {
    return prisma.serviceGroup.update({
      where: { id },
      data,
    });
  }

  static async deleteServiceGroup(id: string) {
    await prisma.service.updateMany({
      where: { serviceGroupId: id },
      data: { serviceGroupId: null },
    });
    return prisma.serviceGroup.delete({
      where: { id },
    });
  }

  static async getServices(serviceGroupId?: string) {
    const where: any = { isActive: true };
    if (serviceGroupId) {
      where.serviceGroupId = serviceGroupId;
    }

    return prisma.service.findMany({
      where,
      include: {
        serviceGroup: true,
        categories: {
          include: {
            materialUsages: {
              include: {
                material: true,
              },
            },
          },
          orderBy: { nameEn: 'asc' },
        },
      },
      orderBy: { nameEn: 'asc' },
    });
  }
  
  static async createService(data: any, imagePath?: string) {
    const { nameEn, nameAm, description, serviceGroupId } = data;
    return prisma.service.create({
      data: {
        nameEn,
        nameAm,
        description: description || null,
        serviceGroupId: serviceGroupId || null,
        imageUrl: imagePath,
      },
      include: {
        serviceGroup: true,
        categories: true,
      },
    });
  }

  static async updateService(id: string, data: any, imagePath?: string) {
    const updateData: any = {};
    if (data.nameEn !== undefined) updateData.nameEn = data.nameEn;
    if (data.nameAm !== undefined) updateData.nameAm = data.nameAm;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.serviceGroupId !== undefined) updateData.serviceGroupId = data.serviceGroupId || null;
    if (imagePath) updateData.imageUrl = imagePath;

    return prisma.service.update({
      where: { id },
      data: updateData,
      include: {
        serviceGroup: true,
        categories: {
          include: {
            materialUsages: {
              include: {
                material: true,
              },
            },
          },
        },
      },
    });
  }

  static async deleteService(id: string) {
    return prisma.service.update({ where: { id }, data: { isActive: false } });
  }

  static async getServiceCategories(serviceId: string) {
    return prisma.serviceCategory.findMany({
      where: { serviceId },
      include: { materialUsages: { include: { material: true } } },
    });
  }

  static async getAllServiceCategories() {
    return prisma.serviceCategory.findMany({
      include: { service: true, materialUsages: { include: { material: true } } },
      orderBy: [
        { service: { nameEn: 'asc' } },
        { nameEn: 'asc' }
      ]
    });
  }

  static async createServiceCategory(serviceId: string, data: any) {
    const { nameEn, nameAm, price, materialUsages } = data;
    return prisma.$transaction(async (tx) => {
      const category = await tx.serviceCategory.create({
        data: {
          serviceId,
          nameEn,
          nameAm,
          price,
        },
      });

      if (materialUsages && materialUsages.length > 0) {
        for (const mu of materialUsages) {
          const mat = await tx.material.findUnique({ where: { id: mu.materialId } });
          if (mat) {
            validateQuantityForUnit(mu.quantity, mat.unit, `Usage quantity for "${mat.nameEn}"`);
          }
        }
        await tx.serviceCategoryMaterialUsage.createMany({
          data: materialUsages.map((mu: any) => ({
            serviceCategoryId: category.id,
            materialId: mu.materialId,
            quantityUsed: mu.quantity,
          })),
        });
      }

      return tx.serviceCategory.findUnique({
        where: { id: category.id },
        include: { materialUsages: { include: { material: true } } },
      });
    });
  }

  static async createServiceCategoryOld(data: any) {
    return prisma.serviceCategory.create({ data });
  }

  static async updateServiceCategory(id: string, data: any) {
    const { nameEn, nameAm, price, materialUsages } = data;
    return prisma.$transaction(async (tx) => {
      const category = await tx.serviceCategory.update({
        where: { id },
        data: {
          nameEn,
          nameAm,
          price,
        },
      });

      // Clear existing
      await tx.serviceCategoryMaterialUsage.deleteMany({
        where: { serviceCategoryId: id },
      });

      // Re-create
      if (materialUsages && materialUsages.length > 0) {
        for (const mu of materialUsages) {
          const mat = await tx.material.findUnique({ where: { id: mu.materialId } });
          if (mat) {
            validateQuantityForUnit(mu.quantity, mat.unit, `Usage quantity for "${mat.nameEn}"`);
          }
        }
        await tx.serviceCategoryMaterialUsage.createMany({
          data: materialUsages.map((mu: any) => ({
            serviceCategoryId: id,
            materialId: mu.materialId,
            quantityUsed: mu.quantity,
          })),
        });
      }

      return tx.serviceCategory.findUnique({
        where: { id },
        include: { materialUsages: { include: { material: true } } },
      });
    });
  }

  static async deleteServiceCategory(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.serviceCategoryMaterialUsage.deleteMany({
        where: { serviceCategoryId: id },
      });
      return tx.serviceCategory.delete({
        where: { id },
      });
    });
  }

  static async setCategoryMaterialUsage(serviceCategoryId: string, materialId: string, quantityUsed: number) {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (material) {
      validateQuantityForUnit(quantityUsed, material.unit, `Usage quantity for "${material.nameEn}"`);
    }
    return prisma.serviceCategoryMaterialUsage.upsert({
      where: { serviceCategoryId_materialId: { serviceCategoryId, materialId } },
      update: { quantityUsed },
      create: { serviceCategoryId, materialId, quantityUsed },
    });
  }

  static async deleteCategoryMaterialUsage(id: string) {
    return prisma.serviceCategoryMaterialUsage.delete({ where: { id } });
  }

  // ==========================================
  // Car Catalog
  // ==========================================
  static async getCarBrands() {
    return prisma.carBrand.findMany({ include: { models: true }, orderBy: { name: 'asc' } });
  }
  static async createCarBrand(data: any, imagePath?: string) {
    return prisma.carBrand.create({ data: { ...data, logoUrl: imagePath } });
  }
  static async updateCarBrand(id: string, data: any, imagePath?: string) {
    const updateData = { ...data };
    
    if (imagePath) {
      updateData.logoUrl = imagePath;
      const existing = await prisma.carBrand.findUnique({ where: { id } });
      if (existing?.logoUrl) deleteFileIfExists(existing.logoUrl);
    }
    return prisma.carBrand.update({ where: { id }, data: updateData });
  }
  static async deleteCarBrand(id: string) {
    const count = await prisma.carModel.count({ where: { brandId: id } });
    if (count > 0) throw new Error('Cannot delete brand; it has one or more models attached.');
    
    const existing = await prisma.carBrand.findUnique({ where: { id } });
    const deleted = await prisma.carBrand.delete({ where: { id } });
    if (existing?.logoUrl) deleteFileIfExists(existing.logoUrl);
    
    return deleted;
  }

  static async getCarModels(brandId: string) {
    return prisma.carModel.findMany({ where: { brandId }, include: { brand: true }, orderBy: { name: 'asc' } });
  }
  static async createCarModel(data: any, imagePath?: string) {
    return prisma.carModel.create({ data: { ...data, imageUrl: imagePath } });
  }
  static async updateCarModel(id: string, data: any, imagePath?: string) {
    const updateData = { ...data };
    
    if (imagePath) {
      updateData.imageUrl = imagePath;
      const existing = await prisma.carModel.findUnique({ where: { id } });
      if (existing?.imageUrl) deleteFileIfExists(existing.imageUrl);
    }
    return prisma.carModel.update({ where: { id }, data: updateData });
  }
  static async deleteCarModel(id: string) {
    const count = await prisma.vehicle.count({ where: { carModelId: id } });
    if (count > 0) throw new Error('Cannot delete model; it is attached to one or more vehicles.');
    
    const existing = await prisma.carModel.findUnique({ where: { id } });
    const deleted = await prisma.carModel.delete({ where: { id } });
    if (existing?.imageUrl) deleteFileIfExists(existing.imageUrl);
    
    return deleted;
  }

  static async getAllCarModels() {
    return prisma.carModel.findMany({ include: { brand: true }, orderBy: { name: 'asc' } });
  }

  static async getCarStatuses() {
    return prisma.carStatus.findMany();
  }
  static async createCarStatus(data: any) {
    return prisma.carStatus.create({ data });
  }
}
