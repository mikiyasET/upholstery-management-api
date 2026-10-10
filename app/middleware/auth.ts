import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { UserPermissions } from '../lib/permissions';
import prisma from '../lib/prisma';

export interface JwtPayload {
  userId: string;
  name: string;
  phone: string;
  role: UserRole;
  permissions?: UserPermissions | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Unauthorized: No token provided' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || 'secret1'
    ) as JwtPayload;

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ error: { message: 'Unauthorized: User not found or inactive' } });
    }

    req.user = {
      userId: dbUser.id,
      name: dbUser.name,
      phone: dbUser.phone,
      role: dbUser.role,
      permissions: dbUser.permissions as any,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Unauthorized: Invalid token' } });
  }
};
