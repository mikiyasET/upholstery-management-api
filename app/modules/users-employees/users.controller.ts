import { Request, Response } from 'express';
import { UsersService } from './users.service';
import { PERMISSION_GROUPS } from '../../lib/permissions';

export class UsersController {
  static async createUser(req: Request, res: Response) {
    try {
      const user = await UsersService.createUser(req.body, req.user!.userId);
      res.status(201).json(user);
    } catch (error: any) {
      if (error.message.includes('Phone already in use')) {
        return res.status(409).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  static async getUsers(req: Request, res: Response) {
    const users = await UsersService.getUsers();
    res.json(users);
  }

  static async updateUser(req: Request, res: Response) {
    const user = await UsersService.updateUser(req.params.id, req.body, req.user!.userId);
    res.json(user);
  }

  /** Returns the permission schema for the frontend to render the toggle grid */
  static async getPermissionSchema(req: Request, res: Response) {
    res.json(PERMISSION_GROUPS);
  }
}
