import { z } from 'zod';
import { phoneSchema } from '../../lib/phone-schema';

export const resolveCustomerVehicleSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    phone: phoneSchema,
    plateNumber: z.string().min(1).optional(),
    carModelId: z.string().min(1).optional(),
  }),
});
