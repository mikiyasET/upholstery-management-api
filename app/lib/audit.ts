import prisma from './prisma';
import { AuditAction } from '@prisma/client';

export class AuditService {
  static async record(
    entityType: string,
    entityId: string,
    action: AuditAction,
    changedById: string,
    oldValue?: any,
    newValue?: any
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          entityType,
          entityId,
          action,
          changedById,
          oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
          newValue: newValue ? JSON.stringify(newValue) : undefined,
        },
      });
    } catch (error) {
      console.error('[AuditService Error]: Failed to record audit log', error);
      // We typically don't throw here to avoid failing the main transaction
      // just because the audit log failed, unless strict compliance is required.
    }
  }
}
