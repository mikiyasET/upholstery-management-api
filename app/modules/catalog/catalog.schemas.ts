import { z } from 'zod';
import { Unit } from '@prisma/client';

export const materialSchema = z.object({
  body: z.object({
    itemCode: z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined), z.string().min(1).optional()),
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
    unit: z.nativeEnum(Unit),
    isBulkTracked: z.preprocess(v => String(v) === 'true', z.boolean()).default(false).optional(),
    lowStockThreshold: z.coerce.number().min(0),
    isStandaloneSellable: z.preprocess(v => String(v) === 'true', z.boolean()).default(false).optional(),
    currentPrice: z.coerce.number().min(0).optional().nullable(),
    brands: z.preprocess(v => {
      if (!v || v === 'null' || v === 'undefined') return undefined;
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return undefined; }
      }
      return v;
    }, z.array(z.object({
      id: z.string().optional(),
      name: z.string().min(1, 'Brand name is required'),
      size: z.string().optional().nullable(),
      color: z.string().optional().nullable(),
      type: z.string().optional().nullable(),
      price: z.coerce.number().min(0, 'Brand price cannot be negative'),
    })).optional()),
  }),
});

export const serviceGroupSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
  }),
});

export const updateServiceGroupSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1).optional(),
    nameAm: z.string().min(1).optional(),
  }),
});

export const serviceSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1),
    nameAm: z.string().min(1),
    description: z.string().optional().nullable(),
    serviceGroupId: z.preprocess(
      v => (typeof v === 'string' && v.trim() !== '' && v !== 'null' && v !== 'undefined' ? v.trim() : null),
      z.string().nullable().optional()
    ),
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
