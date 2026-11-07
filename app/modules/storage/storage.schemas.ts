import { z } from 'zod';
import { AdjustmentReason, StoreType } from '@prisma/client';

export const restockSchema = z.object({
  body: z.object({
    quantityAdded: z.number().positive(),
    unitCost: z.number().min(0).optional().nullable(),
    supplierId: z.string().optional().nullable(),
    materialBrandId: z.string().optional().nullable(),
    storeType: z.nativeEnum(StoreType).optional().nullable(),
    storeId: z.string().optional().nullable(),
  }),
});

export const adjustStockSchema = z.object({
  body: z.object({
    storeId: z.string().min(1),
    quantityDelta: z.number(), // can be positive or negative
    reason: z.nativeEnum(AdjustmentReason),
    notes: z.string().optional().nullable(),
    materialBrandId: z.string().optional().nullable(),
  }),
});

export const storeTransferSchema = z.object({
  body: z.object({
    materialId: z.string().min(1),
    quantityTransferred: z.number().positive(),
    notes: z.string().optional().nullable(),
    responsibleEmployeeId: z.string().optional().nullable(),
    direction: z.string().optional(),
    materialBrandId: z.string().optional().nullable(),
  }),
});

export const stockCountSchema = z.object({
  body: z.object({
    materialId: z.string().min(1),
    storeId: z.string().min(1),
    countedQuantity: z.number().min(0),
    notes: z.string().optional().nullable(),
    materialBrandId: z.string().optional().nullable(),
  }),
});

export const allocateBrandStockSchema = z.object({
  body: z.object({
    storeType: z.enum(['MAIN', 'MINI']),
    allocations: z.array(z.object({
      materialBrandId: z.string().min(1),
      quantity: z.number().min(0),
    })).min(1),
    notes: z.string().optional().nullable(),
  }),
});
