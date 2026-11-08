import { Request, Response } from 'express';
import { OrdersService } from './orders.service';

export class OrdersController {
  static async createOrder(req: Request, res: Response) {
    try {
      const order = await OrdersService.createOrder(req.body, req.user!.userId);
      res.status(201).json(order);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async updateOrderStatus(req: Request, res: Response) {
    const { status, notes } = req.body;
    try {
      const order = await OrdersService.updateOrderStatus(req.params.id, status, notes, req.user!.userId);
      res.json(order);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async addPayment(req: Request, res: Response) {
    const payment = await OrdersService.addPayment(req.params.id, req.body, req.user!.userId);
    res.status(201).json(payment);
  }

  static async addCarStatus(req: Request, res: Response) {
    const status = await OrdersService.addCarStatus(req.params.id, req.body);
    res.status(201).json(status);
  }

  static async addAssignment(req: Request, res: Response) {
    const assignment = await OrdersService.addAssignment(req.params.id, req.body);
    res.status(201).json(assignment);
  }

  static async addServiceLine(req: Request, res: Response) {
    try {
      const line = await OrdersService.addServiceLine(req.params.id, req.body, req.user!.userId);
      res.status(201).json(line);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async updateServiceLine(req: Request, res: Response) {
    const line = await OrdersService.updateServiceLinePrice(
      req.params.id,
      req.params.lineId,
      req.body.priceAtOrderTime,
      req.user!.userId
    );
    res.json(line);
  }

  static async addStandaloneLine(req: Request, res: Response) {
    try {
      const line = await OrdersService.addStandaloneLine(req.params.id, req.body, req.user!.userId);
      res.status(201).json(line);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async updateStandaloneLine(req: Request, res: Response) {
    try {
      const line = await OrdersService.updateStandaloneLine(
        req.params.id,
        req.params.lineId,
        req.body,
        req.user!.userId
      );
      res.json(line);
    } catch (error: any) {
      if (error.message.includes('Insufficient stock')) {
        return res.status(422).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async addAdditionalCharge(req: Request, res: Response) {
    const charge = await OrdersService.addAdditionalCharge(req.params.id, req.body);
    res.status(201).json(charge);
  }

  static async getOrders(req: Request, res: Response) {
    const orders = await OrdersService.getOrders(req.query);
    res.json(orders);
  }

  static async getOrder(req: Request, res: Response) {
    const order = await OrdersService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: { message: 'Order not found' } });
    res.json(order);
  }

  static async removeServiceLine(req: Request, res: Response) {
    await OrdersService.removeServiceLine(req.params.id, req.params.lineId);
    res.json({ success: true });
  }

  static async removeStandaloneLine(req: Request, res: Response) {
    await OrdersService.removeStandaloneLine(req.params.id, req.params.lineId);
    res.json({ success: true });
  }

  static async updateFsrNumber(req: Request, res: Response) {
    const order = await OrdersService.updateFsrNumber(req.params.id, req.body.fsrNumber, req.user!.userId);
    res.json(order);
  }

  static async updateServiceFee(req: Request, res: Response) {
    const order = await OrdersService.updateServiceFee(req.params.id, req.body.serviceFee, req.user!.userId);
    res.json(order);
  }

  static async notifyTelegram(req: Request, res: Response) {
    try {
      const result = await OrdersService.notifyOrderCreated(req.params.id);
      res.json({ success: result });
    } catch (err: any) {
      console.error('[OrdersController] Failed to notify telegram:', err);
      res.status(500).json({ error: { message: 'Failed to send Telegram notification' } });
    }
  }
}
