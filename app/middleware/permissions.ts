import { Request, Response, NextFunction } from 'express';
import { PermissionKey, hasPermission, UserPermissions } from '../lib/permissions';

/**
 * Middleware that checks if the current user has a specific permission.
 * ADMINs bypass all checks automatically.
 * Usage: requirePermission('orders.view')
 */
export const requirePermission = (...keys: PermissionKey[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    // ADMINs always have full access
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const permissions = req.user.permissions as UserPermissions | null;

    for (const key of keys) {
      if (!hasPermission(req.user.role, permissions, key)) {
        return res.status(403).json({
          error: { message: `Forbidden: You do not have the '${key}' permission` }
        });
      }
    }

    next();
  };
};
