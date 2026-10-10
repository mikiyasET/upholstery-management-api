import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { phoneSchema } from '../../lib/phone-schema';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    phone: phoneSchema,
    password: z.string().min(6).optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
    baseSalary: z.coerce.number().optional(),
    contactInfo: z.string().optional(),
    permissions: z.record(z.union([z.boolean(), z.number()])).optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phone: phoneSchema.optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional(),
    baseSalary: z.coerce.number().optional(),
    contactInfo: z.string().optional(),
    permissions: z.record(z.union([z.boolean(), z.number()])).optional(),
  }),
});
