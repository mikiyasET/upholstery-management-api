import { Request, Response } from 'express';
import { CustomersVehiclesService } from './customers-vehicles.service';

export class CustomersVehiclesController {
  static async searchCustomer(req: Request, res: Response) {
    const phone = req.query.phone as string;
    if (!phone) {
      return res.status(400).json({ error: { message: 'Phone query parameter is required' } });
    }
    const customer = await CustomersVehiclesService.searchCustomerByPhone(phone);
    if (!customer) {
      return res.status(404).json({ error: { message: 'Customer not found' } });
    }
    res.json(customer);
  }

  static async getCustomers(req: Request, res: Response) {
    const search = req.query.search as string;
    const customers = await CustomersVehiclesService.getCustomers(search);
    res.json(customers);
  }

  static async getCustomerById(req: Request, res: Response) {
    const customer = await CustomersVehiclesService.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: { message: 'Customer not found' } });
    }
    res.json(customer);
  }

  static async getVehicles(req: Request, res: Response) {
    const search = req.query.search as string;
    const vehicles = await CustomersVehiclesService.getVehicles(search);
    res.json(vehicles);
  }

  static async resolve(req: Request, res: Response) {
    const result = await CustomersVehiclesService.resolveCustomerAndVehicle(req.body);
    res.json(result);
  }

  static async getVehicleHistory(req: Request, res: Response) {
    const history = await CustomersVehiclesService.getVehicleHistory(req.params.id);
    res.json(history);
  }
}
