import { z } from 'zod';

export const dateRangeSchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    group: z.enum(['day', 'month']).optional().default('day'),
  }),
});

export const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
  }),
});
