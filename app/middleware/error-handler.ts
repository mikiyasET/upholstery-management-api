import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[ErrorHandler]:', err);

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

  // Handle Prisma-specific database errors safely without leaking internal details
  const errCode = (err as any).code;
  if (errCode === 'P2002') {
    return res.status(409).json({
      error: {
        message: 'A record with this identifier already exists.',
      },
    });
  }

  if (errCode === 'P2025') {
    return res.status(404).json({
      error: {
        message: 'The requested record was not found.',
      },
    });
  }

  if (errCode === 'P2003') {
    return res.status(400).json({
      error: {
        message: 'Cannot perform this action because other records are linked to it.',
      },
    });
  }

  if (err.name === 'PrismaClientInitializationError') {
    return res.status(503).json({
      error: {
        message: 'Database service is temporarily unavailable. Please try again shortly.',
      },
    });
  }

  if (
    err.name?.startsWith('Prisma') ||
    (err.message && (
      err.message.includes('prisma.') ||
      err.message.includes('libquery_engine') ||
      err.message.includes('libssl')
    ))
  ) {
    return res.status(500).json({
      error: {
        message: 'A database error occurred. Please try again later.',
      },
    });
  }

  // Handle specific clean business logic errors
  if (err.message) {
    if (err.message.includes('Insufficient stock')) {
      return res.status(422).json({
        error: {
          message: err.message,
        },
      });
    }

    if (err.message.includes('Phone already in use')) {
      return res.status(409).json({
        error: {
          message: err.message,
        },
      });
    }

    if (err.message === 'Sale not found' || err.message === 'Customer not found') {
      return res.status(404).json({
        error: {
          message: err.message,
        },
      });
    }

    if (
      err.message === 'Invalid phone number or password' ||
      err.message === 'Employees cannot log in to the system'
    ) {
      return res.status(401).json({
        error: {
          message: err.message,
        },
      });
    }
  }

  res.status(500).json({
    error: {
      message: 'Internal server error',
    },
  });
};
