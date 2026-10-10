import prisma from '../../lib/prisma';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secret1';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret2';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export class AuthService {
  static async login(phone: string, passwordPlain: string) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.isActive || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    // Block EMPLOYEEs from logging in
    if (user.role === UserRole.EMPLOYEE) {
      throw new Error('Employees cannot log in to the system');
    }

    const valid = await argon2.verify(user.passwordHash, passwordPlain);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const payload = {
      userId: user.id,
      role: user.role,
      permissions: user.permissions || null,
    };

    const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY as any });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY as any });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions || null,
      },
    };
  }

  static async refresh(token: string) {
    try {
      const decoded = jwt.verify(token, REFRESH_SECRET) as { userId: string };
      
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.isActive) {
        throw new Error('Invalid or expired refresh token');
      }

      // Block EMPLOYEEs from refreshing tokens
      if (user.role === UserRole.EMPLOYEE) {
        throw new Error('Employees cannot log in to the system');
      }

      const payload = {
        userId: user.id,
        role: user.role,
        permissions: user.permissions || null,
      };
      const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY as any });
      const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY as any });

      return { accessToken, refreshToken };
    } catch (err) {
      throw new Error('Invalid or expired refresh token');
    }
  }
}
