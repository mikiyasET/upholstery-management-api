import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[Error]:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.errors,
      },
    });
  }

  if (err.name === 'MulterError' && (err as any).code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: {
        message: 'File too large. Maximum size is 5MB.',
      },
    });
  }

  // Handle specific Prisma errors or custom business logic errors here
  if (err.message && err.message.includes('Insufficient stock')) {
    return res.status(422).json({
      error: {
        message: err.message,
      },
    });
  }

  res.status(500).json({
    error: {
      message: 'Internal server error',
    },
  });
};
