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

  static async getMaterialHistory(req: Request, res: Response) {
    const history = await StorageService.getMaterialHistory(req.params.id);
    res.json(history);
  }
}
