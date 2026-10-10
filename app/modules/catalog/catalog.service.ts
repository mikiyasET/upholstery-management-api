import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import { AuditAction } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

function deleteFileIfExists(filePath: string | null | undefined) {
  if (!filePath) return;
  const fullPath = path.resolve(process.cwd(), UPLOADS_DIR, filePath);
  if (fs.existsSync(fullPath)) {
    try { fs.unlinkSync(fullPath); } catch (e) { console.error('Error deleting file:', e); }
  }
}

export class CatalogService {
  // ==========================================
  // Materials
  // ==========================================
  static async getMaterials() {
    return prisma.material.findMany({ 
      where: { isActive: true },
      include: { materialStocks: { include: { store: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getMaterial(id: string) {
    return prisma.material.findUnique({ where: { id } });
  }

  static async createMaterial(data: any, userId: string, imagePath?: string) {
    const material = await prisma.material.create({
      data: {
        ...data,
        imageUrl: imagePath,
      },
    });

    if (material.currentPrice) {
      await prisma.priceHistory.create({
        data: {
          materialId: material.id,
          price: material.currentPrice,
          changedById: userId,
        },
      });
    }

    await AuditService.record('Material', material.id, AuditAction.CREATE, userId, null, material);
    return material;
  }

  static async updateMaterial(id: string, data: any, userId: string, imagePath?: string) {
    const old = await prisma.material.findUnique({ where: { id } });
    if (!old) throw new Error('Material not found');

    const updateData = { ...data };
    if (imagePath) updateData.imageUrl = imagePath;

    const material = await prisma.material.update({
      where: { id },
      data: updateData,
    });

    if (updateData.currentPrice !== undefined && updateData.currentPrice !== Number(old.currentPrice)) {
      await prisma.priceHistory.create({
        data: {
          materialId: material.id,
          price: updateData.currentPrice,
          changedById: userId,
        },
      });
    }

    await AuditService.record('Material', material.id, AuditAction.UPDATE, userId, old, material);
    return material;
  }

  static async deleteMaterial(id: string, userId: string) {
    const material = await prisma.material.update({
      where: { id },
      data: { isActive: false },
    });
    await AuditService.record('Material', id, AuditAction.DELETE, userId, null, null);
    return material;
  }

  // ==========================================
  // Services & Categories
  // ==========================================
  static async getServiceGroups() {
    return prisma.serviceGroup.findMany();
  }
  static async createServiceGroup(data: any) {
    return prisma.serviceGroup.create({ data });
  }

  static async getServices() {
    return prisma.service.findMany({
      where: { isActive: true },
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
          orderBy: { nameEn: 'asc' }
        },
      },
      orderBy: { nameEn: 'asc' }
    });
  }
  
  static async createService(data: any, imagePath?: string) {
    return prisma.service.create({
      data: { ...data, imageUrl: imagePath },
    });
  }

  static async updateService(id: string, data: any, imagePath?: string) {
    const updateData = { ...data };
    if (imagePath) updateData.imageUrl = imagePath;
    return prisma.service.update({ where: { id }, data: updateData });
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
