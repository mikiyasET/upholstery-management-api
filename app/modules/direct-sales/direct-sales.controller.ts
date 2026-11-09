import { Request, Response } from 'express';
import { DirectSalesService } from './direct-sales.service';

export class DirectSalesController {
  static async createDirectSale(req: Request, res: Response) {
    try {
      const sale = await DirectSalesService.createDirectSale(req.body, req.user!.userId);
      res.status(201).json(sale);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async updateDirectSale(req: Request, res: Response) {
    try {
      const sale = await DirectSalesService.updateDirectSale(req.params.id, req.body, req.user!.userId);
      res.status(200).json(sale);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: error.message } });
      }
      if (error.message === 'Sale not found') {
        return res.status(404).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async getDirectSales(req: Request, res: Response) {
    const filters = {
      search: req.query.search ? String(req.query.search).trim() : undefined,
      fsrNumber: req.query.fsrNumber ? String(req.query.fsrNumber).trim() : undefined,
    };
    const sales = await DirectSalesService.getDirectSales(filters);
    res.json(sales);
  }

  static async getDirectSale(req: Request, res: Response) {
    const sale = await DirectSalesService.getDirectSale(req.params.id);
    if (!sale) return res.status(404).json({ error: { message: 'Not found' } });
    res.json(sale);
  }

  static async updateFsrNumber(req: Request, res: Response) {
    try {
      const sale = await DirectSalesService.updateFsrNumber(
        req.params.id,
        req.body.fsrNumber,
        req.user!.userId
      );
      res.json(sale);
    } catch (error: any) {
      if (error.message === 'Direct sale not found') {
        return res.status(404).json({ error: { message: error.message } });
      }
      throw error;
    }
  }
}
