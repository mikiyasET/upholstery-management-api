import { Request, Response } from 'express';
import { StorageService } from './storage.service';

export class StorageController {
  static async getLowStockMaterials(req: Request, res: Response) {
    const materials = await StorageService.getLowStockMaterials();
    res.json(materials);
  }

  static async restock(req: Request, res: Response) {
    const result = await StorageService.restock(req.params.id, req.body, req.user!.userId);
    res.status(201).json(result);
  }

  static async adjustStock(req: Request, res: Response) {
    const result = await StorageService.adjustStock(req.params.id, req.body, req.user!.userId);
    res.status(201).json(result);
  }

  static async storeTransfer(req: Request, res: Response) {
    try {
      const result = await StorageService.storeTransfer(req.body, req.user!.userId);
      res.status(201).json(result);
    } catch (err: any) {
      if (err.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: err.message } });
      }
      throw err;
    }
  }

  static async stockCount(req: Request, res: Response) {
    const result = await StorageService.stockCount(req.body, req.user!.userId);
    res.status(201).json(result);
  }

  static async allocateBrandStock(req: Request, res: Response) {
    const result = await StorageService.allocateBrandStock(req.params.id, req.body, req.user!.userId);
    res.status(200).json(result);
  }

  static async getAllStockHistory(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const materialId = req.query.materialId as string | undefined;
    const type = req.query.type as string | undefined;
    const storeType = req.query.storeType as 'MAIN' | 'MINI' | 'ALL' | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const minPrice = req.query.minPrice !== undefined && req.query.minPrice !== '' ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? parseFloat(req.query.maxPrice as string) : undefined;
    const search = req.query.search as string | undefined;

    const result = await StorageService.getAllStockHistory({
      page,
      limit,
      materialId,
      type,
      storeType,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      search,
    });
    res.json(result);
  }

  static async getMaterialHistory(req: Request, res: Response) {
    const history = await StorageService.getMaterialHistory(req.params.id);
    res.json(history);
  }
}
