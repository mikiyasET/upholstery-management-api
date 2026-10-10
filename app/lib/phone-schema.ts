import { z } from 'zod';

const transformPhone = (val: string, ctx: z.RefinementCtx) => {
  let p = val.replace(/[\s-]/g, '');
  if (p.startsWith('+251')) {
    p = '0' + p.substring(4);
  } else if (p.startsWith('251')) {
    p = '0' + p.substring(3);
  } else if (p.length === 9 && (p.startsWith('9') || p.startsWith('7'))) {
    p = '0' + p;
  }
  
  if (!/^0(9|7)\d{8}$/.test(p)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid Ethiopian phone number. Must be 09... or 07...",
    });
    return z.NEVER;
  }
  return p;
};

export const phoneSchema = z.string().min(1, 'Phone number is required').transform(transformPhone);

export const optionalPhoneSchema = z.string().optional().nullable().transform((val, ctx) => {
  if (!val || val.trim() === '') return val;
  return transformPhone(val, ctx);
});
