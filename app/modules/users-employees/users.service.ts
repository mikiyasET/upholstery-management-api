import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import * as argon2 from 'argon2';
import { AuditAction, UserRole } from '@prisma/client';
import { getDefaultAdminPermissions, getDefaultManagerPermissions } from '../../lib/permissions';

export class UsersService {
  static async createUser(data: any, currentUserId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { phone: data.phone } });
      if (existing) throw new Error('Phone already in use');

      const role = data.role as UserRole;

      // Employees can't log in — no password allowed
      let passwordHash = null;
      if (role === UserRole.EMPLOYEE) {
        // No password for employees
        passwordHash = null;
      } else if (data.password) {
        passwordHash = await argon2.hash(data.password);
      } else {
        throw new Error('Password is required for Admins and Managers');
      }

      // Build permissions based on role
      let permissions: any = null;
      if (role === UserRole.ADMIN) {
        // Admins get full access by default
        // But caller can optionally toggle off users.view/users.edit
        const defaultPerms = getDefaultAdminPermissions();
        if (data.permissions) {
          if (data.permissions['users.view'] === false) defaultPerms['users.view'] = false;
          if (data.permissions['users.edit'] === false) defaultPerms['users.edit'] = false;
        }
        permissions = defaultPerms;
      } else if (role === UserRole.MANAGER) {
        // Managers get the exact permissions sent from the frontend
        permissions = data.permissions || getDefaultManagerPermissions();
      }
      // EMPLOYEE: permissions stays null

      // Automatically create Employee profile
      const employee = await tx.employee.create({
        data: {
          name: data.name,
          phone: data.phone,
          baseSalary: role === UserRole.ADMIN ? null : (data.baseSalary || null),
          contactInfo: data.contactInfo || null,
        }
      });

      const user = await tx.user.create({
        data: {
          name: data.name,
          phone: data.phone,
          passwordHash,
          role,
          permissions,
          employeeId: employee.id,
        },
      });

      const { passwordHash: _, ...safeUser } = user;
      await AuditService.record('User', user.id, AuditAction.CREATE, currentUserId, null, safeUser);
      return safeUser;
    });
  }

  static async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        permissions: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        employee: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateUser(id: string, data: any, currentUserId: string) {
    return prisma.$transaction(async (tx) => {
      const old = await tx.user.findUnique({ where: { id }, include: { employee: true } });
      if (!old) throw new Error('User not found');

      const newRole = (data.role as UserRole) || old.role;

      const userUpdateData: any = {};
      if (data.name !== undefined) userUpdateData.name = data.name;
      if (data.phone !== undefined) userUpdateData.phone = data.phone;
      if (data.role !== undefined) userUpdateData.role = data.role;
      if (data.isActive !== undefined) userUpdateData.isActive = data.isActive;

      // Handle password
      if (newRole === UserRole.EMPLOYEE) {
        // Strip password when changing to employee
        userUpdateData.passwordHash = null;
      } else if (data.password) {
        userUpdateData.passwordHash = await argon2.hash(data.password);
      }

      // Handle permissions
      if (data.permissions !== undefined || data.role !== undefined) {
        if (newRole === UserRole.ADMIN) {
          const defaultPerms = getDefaultAdminPermissions();
          if (data.permissions) {
            if (data.permissions['users.view'] === false) defaultPerms['users.view'] = false;
            if (data.permissions['users.edit'] === false) defaultPerms['users.edit'] = false;
          }
          userUpdateData.permissions = defaultPerms;
        } else if (newRole === UserRole.MANAGER) {
          userUpdateData.permissions = data.permissions || old.permissions || getDefaultManagerPermissions();
        } else {
          // EMPLOYEE
          userUpdateData.permissions = null;
        }
      }

      const user = await tx.user.update({
        where: { id },
        data: userUpdateData,
      });

      if (data.baseSalary !== undefined || data.contactInfo !== undefined || data.name !== undefined || data.phone !== undefined) {
        const empUpdateData: any = {};
        if (data.name !== undefined) empUpdateData.name = data.name;
        if (data.phone !== undefined) empUpdateData.phone = data.phone;
        if (data.baseSalary !== undefined) {
          empUpdateData.baseSalary = newRole === UserRole.ADMIN ? null : data.baseSalary;
        }
        if (data.contactInfo !== undefined) empUpdateData.contactInfo = data.contactInfo;

        if (old.employee) {
          await tx.employee.update({
            where: { id: old.employee.id },
            data: empUpdateData
          });
        }
      }

      const { passwordHash: _oldPw, ...safeOld } = old;
      const { passwordHash: _newPw, ...safeUser } = user;

      await AuditService.record('User', user.id, AuditAction.UPDATE, currentUserId, safeOld, safeUser);
      return safeUser;
    });
  }
}
