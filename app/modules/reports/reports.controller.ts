import { Request, Response } from 'express';
import { ReportsService } from './reports.service';

export class ReportsController {
  static async getRevenue(req: Request, res: Response) {
    const { startDate, endDate, group } = req.query;
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const report = await ReportsService.getRevenue(start, end, group as 'day' | 'month');
    res.json(report);
  }

  static async getTopServices(req: Request, res: Response) {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const report = await ReportsService.getTopServices(start, end);
    res.json(report);
  }

  static async getTopMaterials(req: Request, res: Response) {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const report = await ReportsService.getTopMaterials(start, end);
    res.json(report);
  }

  static async getInventoryValuation(req: Request, res: Response) {
    const valuation = await ReportsService.getStockValuation();
    res.json(valuation);
  }

  static async getStaffWorkload(req: Request, res: Response) {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const report = await ReportsService.getStaffWorkload(start, end);
    res.json(report);
  }

  static async getStoreTransfers(req: Request, res: Response) {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const report = await ReportsService.getStoreTransfers(start, end);
    res.json(report);
  }

  static async getAuditLogs(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await ReportsService.getAuditLogs(page, limit);
    res.json(logs);
  }
}
