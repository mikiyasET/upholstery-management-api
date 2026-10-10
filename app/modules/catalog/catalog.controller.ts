import { Request, Response } from 'express';
import { CatalogService } from './catalog.service';
import fs from 'fs';
import path from 'path';

export class CatalogController {
  // ==========================================
  // Materials
  // ==========================================
  static async getMaterials(req: Request, res: Response) {
    const items = await CatalogService.getMaterials();
    res.json(items);
  }

  static async getMaterial(req: Request, res: Response) {
    const item = await CatalogService.getMaterial(req.params.id);
    if (!item) return res.status(404).json({ error: { message: 'Not found' } });
    res.json(item);
  }

  static async createMaterial(req: Request, res: Response) {
    const imagePath = req.file ? `materials/${req.file.filename}` : undefined;
    const material = await CatalogService.createMaterial(req.body, req.user!.userId, imagePath);
    res.status(201).json(material);
  }

  static async updateMaterial(req: Request, res: Response) {
    const imagePath = req.file ? `materials/${req.file.filename}` : undefined;
    // Optionally delete old image from disk here
    const material = await CatalogService.updateMaterial(req.params.id, req.body, req.user!.userId, imagePath);
    res.json(material);
  }

  static async deleteMaterial(req: Request, res: Response) {
    await CatalogService.deleteMaterial(req.params.id, req.user!.userId);
    res.json({ success: true });
  }

  // ==========================================
  // Services & Categories
  // ==========================================
  static async getServiceGroups(req: Request, res: Response) {
    res.json(await CatalogService.getServiceGroups());
  }
  static async createServiceGroup(req: Request, res: Response) {
    res.status(201).json(await CatalogService.createServiceGroup(req.body));
  }

  static async getServices(req: Request, res: Response) {
    res.json(await CatalogService.getServices());
  }
  static async createService(req: Request, res: Response) {
    const imagePath = req.file ? `services/${req.file.filename}` : undefined;
    res.status(201).json(await CatalogService.createService(req.body, imagePath));
  }
  static async updateService(req: Request, res: Response) {
    const imagePath = req.file ? `services/${req.file.filename}` : undefined;
    res.json(await CatalogService.updateService(req.params.id, req.body, imagePath));
  }
  static async deleteService(req: Request, res: Response) {
    await CatalogService.deleteService(req.params.id);
    res.json({ success: true });
  }

  static async getServiceCategories(req: Request, res: Response) {
    const categories = await CatalogService.getServiceCategories(req.params.serviceId);
    res.json(categories);
  }

  static async getAllServiceCategories(req: Request, res: Response) {
    const categories = await CatalogService.getAllServiceCategories();
    res.json(categories);
  }

  static async createServiceCategory(req: Request, res: Response) {
    const { serviceId } = req.params;
    res.status(201).json(await CatalogService.createServiceCategory(serviceId, req.body));
  }

  static async createServiceCategoryOld(req: Request, res: Response) {
    res.status(201).json(await CatalogService.createServiceCategoryOld(req.body));
  }

  static async updateServiceCategory(req: Request, res: Response) {
    const { id } = req.params;
    res.json(await CatalogService.updateServiceCategory(id, req.body));
  }

  static async deleteServiceCategory(req: Request, res: Response) {
    const { id } = req.params;
    await CatalogService.deleteServiceCategory(id);
    res.json({ success: true });
  }

  static async setCategoryMaterialUsage(req: Request, res: Response) {
    const { serviceCategoryId, materialId, quantityUsed } = req.body;
    res.json(await CatalogService.setCategoryMaterialUsage(serviceCategoryId, materialId, quantityUsed));
  }
  static async deleteCategoryMaterialUsage(req: Request, res: Response) {
    await CatalogService.deleteCategoryMaterialUsage(req.params.id);
    res.json({ success: true });
  }

  // ==========================================
  // Cars
  // ==========================================
  static async getCarBrands(req: Request, res: Response) {
    res.json(await CatalogService.getCarBrands());
  }
  static async createCarBrand(req: Request, res: Response) {
    const imagePath = req.file ? `cars/brands/${req.file.filename}` : undefined;
    res.status(201).json(await CatalogService.createCarBrand(req.body, imagePath));
  }
  static async updateCarBrand(req: Request, res: Response) {
    const imagePath = req.file ? `cars/brands/${req.file.filename}` : undefined;
    res.json(await CatalogService.updateCarBrand(req.params.id, req.body, imagePath));
  }
  static async deleteCarBrand(req: Request, res: Response) {
    res.json(await CatalogService.deleteCarBrand(req.params.id));
  }

  static async getCarModels(req: Request, res: Response) {
    res.json(await CatalogService.getCarModels(req.params.brandId));
  }
  static async createCarModel(req: Request, res: Response) {
    const imagePath = req.file ? `cars/models/${req.file.filename}` : undefined;
    res.status(201).json(await CatalogService.createCarModel(req.body, imagePath));
  }
  static async updateCarModel(req: Request, res: Response) {
    const imagePath = req.file ? `cars/models/${req.file.filename}` : undefined;
    res.json(await CatalogService.updateCarModel(req.params.id, req.body, imagePath));
  }
  static async deleteCarModel(req: Request, res: Response) {
    res.json(await CatalogService.deleteCarModel(req.params.id));
  }

  static async getAllCarModels(req: Request, res: Response) {
    res.json(await CatalogService.getAllCarModels());
  }

  static async getCarStatuses(req: Request, res: Response) {
    res.json(await CatalogService.getCarStatuses());
  }
  static async createCarStatus(req: Request, res: Response) {
    res.status(201).json(await CatalogService.createCarStatus(req.body));
  }
}
