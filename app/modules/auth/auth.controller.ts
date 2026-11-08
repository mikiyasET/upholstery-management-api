import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  static async login(req: Request, res: Response) {
    const { phone, password } = req.body;

    try {
      const result = await AuthService.login(phone, password);
      res.json(result);
    } catch (error: any) {
      if (
        error.message === 'Invalid phone number or password' ||
        error.message === 'Invalid credentials' ||
        error.message === 'Employees cannot log in to the system'
      ) {
        return res.status(401).json({ error: { message: error.message } });
      }

      console.error('[AuthController.login] Server error during login:', error);
      return res.status(500).json({
        error: {
          message: 'Unable to process login due to a server error. Please try again later.',
        },
      });
    }
  }

  static async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;

    try {
      const result = await AuthService.refresh(refreshToken);
      res.json(result);
    } catch (error: any) {
      if (
        error.message === 'Invalid or expired refresh token' ||
        error.message === 'Employees cannot log in to the system'
      ) {
        return res.status(401).json({ error: { message: error.message } });
      }

      console.error('[AuthController.refresh] Server error during refresh:', error);
      return res.status(500).json({
        error: {
          message: 'Unable to refresh session due to a server error.',
        },
      });
    }
  }

  static async me(req: Request, res: Response) {
    // Map to the same shape as the login response for frontend compatibility
    const u = req.user!;
    res.json({
      user: {
        id: u.userId,
        name: u.name,
        phone: u.phone,
        role: u.role,
        permissions: u.permissions || null,
      },
    });
  }

  static async logout(req: Request, res: Response) {
    // With JWT, logout is mostly handled client-side by deleting tokens.
    // For a simple implementation without token invalidation table, we just return success.
    res.json({ message: 'Logged out successfully' });
  }
}
