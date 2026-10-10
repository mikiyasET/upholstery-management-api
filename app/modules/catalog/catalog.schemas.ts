import { z } from 'zod';
import { Unit } from '@prisma/client';

export const materialSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
    unit: z.nativeEnum(Unit),
    isBulkTracked: z.preprocess(v => String(v) === 'true', z.boolean()).default(false).optional(),
    lowStockThreshold: z.coerce.number().min(0),
    isStandaloneSellable: z.preprocess(v => String(v) === 'true', z.boolean()).default(false).optional(),
    currentPrice: z.coerce.number().min(0).optional().nullable(),
  }),
});

export const serviceGroupSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
  }),
});

export const serviceSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
    description: z.string().optional().nullable(),
    serviceGroupId: z.string().optional().nullable(),
  }),
});

export const serviceCategorySchema = z.object({
  body: z.object({
    serviceId: z.string().min(1),
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
    price: z.coerce.number().min(0),
  }),
});

export const createServiceCategorySchema = z.object({
  body: z.object({
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
    price: z.coerce.number().min(0),
    materialUsages: z.array(
      z.object({
        materialId: z.string().min(1),
        quantity: z.coerce.number().min(0),
      })
    ).optional(),
  }),
});

export const updateServiceCategorySchema = createServiceCategorySchema;

export const serviceCategoryMaterialUsageSchema = z.object({
  body: z.object({
    materialId: z.string().min(1),
    quantityUsed: z.coerce.number().min(0),
  }),
});

export const carBrandSchema = z.object({
  body: z.object({
    name: z.string().min(1),
  }),
});

export const updateCarBrandSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
  }),
});

export const carModelSchema = z.object({
  body: z.object({
    brandId: z.string().min(1),
    name: z.string().min(1),
  }),
});

export const updateCarModelSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    brandId: z.string().min(1).optional(),
  }),
});

export const carStatusSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
    description: z.string().optional().nullable(),
  }),
});
