import { z } from 'zod';

export const createAssetSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1, 'English name is required'),
    nameAm: z.string().min(1, 'Amharic name is required'),
    description: z.preprocess(v => (v === 'null' || v === 'undefined' ? null : v), z.string().optional().nullable()),
    quantity: z.coerce.number().min(0, 'Quantity cannot be negative').default(1),
    unit: z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? v.trim() : 'PCS'), z.string().default('PCS')),
    category: z.preprocess(v => (v === 'null' || v === 'undefined' ? null : v), z.string().optional().nullable()),
    location: z.preprocess(v => (v === 'null' || v === 'undefined' ? null : v), z.string().optional().nullable()),
    assetTag: z.preprocess(
      v => (typeof v === 'string' && v.trim() !== '' && v !== 'null' ? v.trim() : undefined),
      z.string().optional()
    ),
  }),
});

export const updateAssetSchema = z.object({
  body: z.object({
    nameEn: z.string().min(1).optional(),
    nameAm: z.string().min(1).optional(),
    description: z.preprocess(v => (v === 'null' || v === 'undefined' ? null : v), z.string().optional().nullable()),
    quantity: z.preprocess(v => (v !== undefined && v !== '' ? Number(v) : undefined), z.number().min(0).optional()),
    unit: z.preprocess(v => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined), z.string().optional()),
    category: z.preprocess(v => (v === 'null' || v === 'undefined' ? null : v), z.string().optional().nullable()),
    location: z.preprocess(v => (v === 'null' || v === 'undefined' ? null : v), z.string().optional().nullable()),
    assetTag: z.preprocess(
      v => (typeof v === 'string' && v.trim() !== '' && v !== 'null' ? v.trim() : undefined),
      z.string().optional().nullable()
    ),
    auditNote: z.preprocess(v => (v === 'null' || v === 'undefined' ? null : v), z.string().optional().nullable()),
  }),
});

