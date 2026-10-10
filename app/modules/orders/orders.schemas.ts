import { z } from 'zod';
import { OrderStatus, PaymentMethod } from '@prisma/client';

export const createOrderSchema = z.object({
  body: z.object({
    customerName: z.string().min(1),
    customerPhone: z.string().min(1),
    plateNumber: z.string().optional(),
    carModelId: z.string().optional(),

    serviceLines: z.array(z.object({
      serviceCategoryId: z.string().min(1),
      priceMultiplier: z.number().min(0).default(1),
      discount: z.number().min(0).default(0),
    })).optional().default([]),

    standaloneLines: z.array(z.object({
      materialId: z.string().min(1),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0), // captured price at time of order
      discount: z.number().min(0).default(0),
    })).optional().default([]),

    additionalDiscount: z.number().min(0).default(0),
    taxRate: z.number().min(0).default(0),
    notes: z.string().optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(OrderStatus),
    notes: z.string().optional(),
  }),
});

export const addPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
    method: z.nativeEnum(PaymentMethod),
    referenceNumber: z.string().optional(),
  }),
});

export const addCarStatusSchema = z.object({
  body: z.object({
    carStatusId: z.string().optional(),
    customName: z.string().optional(),
    customDescription: z.string().optional(),
  }),
});

export const addAssignmentSchema = z.object({
  body: z.object({
    employeeId: z.string().min(1),
    roleLabel: z.string().min(1),
  }),
});

export const addServiceLineSchema = z.object({
  body: z.object({
    serviceCategoryId: z.string().min(1),
    priceMultiplier: z.number().min(0).default(1),
  }),
});

export const addStandaloneLineSchema = z.object({
  body: z.object({
    materialId: z.string().min(1),
    quantity: z.number().positive(),
  }),
});

export const addAdditionalChargeSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    description: z.string().optional(),
  }),
});
