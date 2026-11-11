import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import type { Request, Response, NextFunction } from 'express';

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

export const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10);
export const SIZE_THRESHOLD_BYTES = 200 * 1024; // 200 KB
export const MAX_DIMENSION_PX = 800; // 800px maximum dimension
export const WEBP_QUALITY = 85; // 85% WebP quality

export function getUploadSubfolder(url: string): string {
  if (url.includes('materials')) return 'materials';
  if (url.includes('services')) return 'services';
  if (url.includes('assets')) return 'assets';
  if (url.includes('car-brands')) return 'cars/brands';
  if (url.includes('car-models') || url.includes('cars')) return 'cars/models';
  return 'misc';
}

export function sanitizeToKebabCase(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // convert non-alphanumeric chars to hyphens
    .replace(/^-+|-+$/g, ''); // strip leading/trailing hyphens
}

export function generateKebabFilename(req: Request, file: Express.Multer.File): string {
  const parts: string[] = [];

  // Check code/tag first (e.g. MAT-0001 or AST-0012)
  const itemCode = req.body?.itemCode || req.body?.assetTag;
  if (itemCode && typeof itemCode === 'string') {
    const cleanedCode = sanitizeToKebabCase(itemCode);
    if (cleanedCode) parts.push(cleanedCode);
  }

  // Check descriptive name (e.g. "Polishing Compound", "Full Detailing", etc.)
  const name = req.body?.nameEn || req.body?.name || req.body?.title;
  if (name && typeof name === 'string') {
    const cleanedName = sanitizeToKebabCase(name);
    if (cleanedName) parts.push(cleanedName);
  }

  // If no body metadata is available, use the original file name
  if (parts.length === 0 && file.originalname) {
    const parsedName = path.parse(file.originalname).name;
    const cleanedOriginal = sanitizeToKebabCase(parsedName);
    if (cleanedOriginal) parts.push(cleanedOriginal);
  }

  // Fallback if everything was non-alphanumeric or empty
  if (parts.length === 0) {
    parts.push('image');
  }

  // Limit slug length to 50 chars for neat filesystem paths
  const baseKebab = parts.join('-').slice(0, 50).replace(/-+$/, '');

  // Add a unique alphanumeric collision-safe suffix (e.g. m3k8q-1a2b)
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  return `${baseKebab}-${uniqueSuffix}.webp`;
}

export async function processUploadedImage(req: Request, file: Express.Multer.File): Promise<void> {
  const url = req.originalUrl || req.baseUrl || req.url || '';
  const subfolder = getUploadSubfolder(url);
  const destDir = path.resolve(UPLOADS_DIR, subfolder);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const finalFilename = generateKebabFilename(req, file);
  const destPath = path.join(destDir, finalFilename);

  const originalSize = file.size || file.buffer?.length || 0;
  const isOver200Kb = originalSize > SIZE_THRESHOLD_BYTES;

  let pipeline = sharp(file.buffer).rotate();

  if (isOver200Kb) {
    // Dimension Normalization to maximum dimension of 800px (crisp for high-DPI displays and preview modals, while remaining lightweight)
    pipeline = pipeline.resize({
      width: MAX_DIMENSION_PX,
      height: MAX_DIMENSION_PX,
      fit: 'inside', // preserves aspect ratio, neither dimension exceeds 800px
      withoutEnlargement: true,
    });
  }

  // For all images that are uploaded either 200kb or not the quality have to be 85 and should be webp.
  const webpBuffer = await pipeline
    .webp({
      quality: WEBP_QUALITY,
      effort: 4,
    })
    .toBuffer();

  await fs.promises.writeFile(destPath, webpBuffer);

  // Update Express.Multer.File properties so downstream controllers and services have accurate file details
  file.filename = finalFilename;
  file.path = destPath;
  file.destination = destDir;
  file.mimetype = 'image/webp';
  file.size = webpBuffer.length;
}

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const multerMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter,
});

export const upload = {
  single: (fieldName: string) => {
    const middleware = multerMemory.single(fieldName);
    return (req: Request, res: Response, next: NextFunction) => {
      middleware(req, res, async (err: any) => {
        if (err) return next(err);
        if (!req.file) return next();

        try {
          await processUploadedImage(req, req.file);
          next();
        } catch (procErr: any) {
          next(new Error(`Failed to process uploaded image: ${procErr?.message || procErr}`));
        }
      });
    };
  },
  array: (fieldName: string, maxCount?: number) => {
    const middleware = multerMemory.array(fieldName, maxCount);
    return (req: Request, res: Response, next: NextFunction) => {
      middleware(req, res, async (err: any) => {
        if (err) return next(err);
        if (!req.files || !(req.files as Express.Multer.File[]).length) return next();

        try {
          for (const file of req.files as Express.Multer.File[]) {
            await processUploadedImage(req, file);
          }
          next();
        } catch (procErr: any) {
          next(new Error(`Failed to process uploaded images: ${procErr?.message || procErr}`));
        }
      });
    };
  },
  fields: (fields: multer.Field[]) => {
    const middleware = multerMemory.fields(fields);
    return (req: Request, res: Response, next: NextFunction) => {
      middleware(req, res, async (err: any) => {
        if (err) return next(err);
        if (!req.files) return next();

        try {
          const filesDict = req.files as { [fieldname: string]: Express.Multer.File[] };
          for (const key of Object.keys(filesDict)) {
            for (const file of filesDict[key]) {
              await processUploadedImage(req, file);
            }
          }
          next();
        } catch (procErr: any) {
          next(new Error(`Failed to process uploaded images: ${procErr?.message || procErr}`));
        }
      });
    };
  },
  none: () => multerMemory.none(),
  any: () => {
    const middleware = multerMemory.any();
    return (req: Request, res: Response, next: NextFunction) => {
      middleware(req, res, async (err: any) => {
        if (err) return next(err);
        if (!req.files || !(req.files as Express.Multer.File[]).length) return next();

        try {
          for (const file of req.files as Express.Multer.File[]) {
            await processUploadedImage(req, file);
          }
          next();
        } catch (procErr: any) {
          next(new Error(`Failed to process uploaded images: ${procErr?.message || procErr}`));
        }
      });
    };
  },
};
