import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { optionalPhoneSchema } from '../../lib/phone-schema';

export const createDirectSaleSchema = z.object({
  body: z.object({
    customerName: z.string().optional().nullable(),
    customerPhone: optionalPhoneSchema,
    
    items: z.array(z.object({
      materialId: z.string().min(1),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
      discount: z.number().min(0).default(0),
    })).min(1),

    additionalDiscount: z.number().min(0).default(0),
    taxEnabled: z.boolean().default(true),
    taxRate: z.number().min(0).default(0.15),
    
    payments: z.array(z.object({
      method: z.nativeEnum(PaymentMethod),
      amount: z.number().min(0),
      referenceNumber: z.string().optional(),
    })).min(1),

    notes: z.string().optional(),
  }),
});
