import { Request, Response } from 'express';
import { AssetsService } from './assets.service';

export class AssetsController {
  static async getAssets(req: Request, res: Response) {
    const { search, category, status } = req.query as {
      search?: string;
      category?: string;
      status?: 'active' | 'trash' | 'all';
    };
    const assets = await AssetsService.getAssets({ search, category, status });
    res.json(assets);
  }

  static async getTrashSummary(req: Request, res: Response) {
    const summary = await AssetsService.getTrashSummary();
    res.json(summary);
  }

  static async getAssetById(req: Request, res: Response) {
    const asset = await AssetsService.getAssetById(req.params.id);
    res.json(asset);
  }

  static async createAsset(req: Request, res: Response) {
    const imagePath = req.file ? `assets/${req.file.filename}` : undefined;
    const asset = await AssetsService.createAsset(req.body, req.user!.userId, imagePath);
    res.status(201).json(asset);
  }

  static async updateAsset(req: Request, res: Response) {
    const imagePath = req.file ? `assets/${req.file.filename}` : undefined;
    const asset = await AssetsService.updateAsset(req.params.id, req.body, req.user!.userId, imagePath);
    res.json(asset);
  }

  static async moveToTrash(req: Request, res: Response) {
    const asset = await AssetsService.moveToTrash(req.params.id, req.user!.userId);
    res.json({ success: true, message: 'Asset moved to 30-day retention trash bin', asset });
  }

  static async restoreFromTrash(req: Request, res: Response) {
    const asset = await AssetsService.restoreFromTrash(req.params.id, req.user!.userId);
    res.json({ success: true, message: 'Asset restored from trash', asset });
  }

  static async permanentDelete(req: Request, res: Response) {
    await AssetsService.permanentDelete(req.params.id);
    res.json({ success: true, message: 'Asset permanently deleted' });
  }
}

