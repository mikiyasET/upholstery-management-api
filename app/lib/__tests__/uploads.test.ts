import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import {
  sanitizeToKebabCase,
  generateKebabFilename,
  getUploadSubfolder,
  processUploadedImage,
  SIZE_THRESHOLD_BYTES,
  MAX_DIMENSION_PX,
  WEBP_QUALITY,
  UPLOADS_DIR,
} from '../uploads';

describe('Uploads & Image Normalization Pipeline', () => {
  describe('sanitizeToKebabCase', () => {
    it('converts mixed-case strings with spaces and symbols to kebab-case', () => {
      expect(sanitizeToKebabCase('Front Bumper (V2) - Special Edition!')).toBe('front-bumper-v2-special-edition');
      expect(sanitizeToKebabCase('MAT-0001')).toBe('mat-0001');
      expect(sanitizeToKebabCase('  Polishing   Compound   ')).toBe('polishing-compound');
    });

    it('removes accents and diacritics', () => {
      expect(sanitizeToKebabCase('Café Crème')).toBe('cafe-creme');
    });

    it('handles empty or non-alphanumeric strings gracefully', () => {
      expect(sanitizeToKebabCase('---')).toBe('');
      expect(sanitizeToKebabCase('!!! @@@ ###')).toBe('');
    });
  });

  describe('generateKebabFilename', () => {
    it('generates kebab-case filename from itemCode and nameEn', () => {
      const req = { body: { itemCode: 'MAT-0003', nameEn: 'Polishing Compound' } } as any;
      const file = { originalname: 'raw_image_01.jpg' } as any;

      const filename = generateKebabFilename(req, file);
      expect(filename).toMatch(/^mat-0003-polishing-compound-[a-z0-9]+-[a-z0-9]+\.webp$/);
      expect(filename.endsWith('.webp')).toBe(true);
    });

    it('falls back to original filename when body is empty', () => {
      const req = { body: {} } as any;
      const file = { originalname: 'My New Car Wax.PNG' } as any;

      const filename = generateKebabFilename(req, file);
      expect(filename).toMatch(/^my-new-car-wax-[a-z0-9]+-[a-z0-9]+\.webp$/);
      expect(filename.endsWith('.webp')).toBe(true);
    });

    it('uses fallback "image" if both body and originalname are non-alphanumeric', () => {
      const req = { body: {} } as any;
      const file = { originalname: 'የመኪና.png' } as any;

      const filename = generateKebabFilename(req, file);
      expect(filename).toMatch(/^image-[a-z0-9]+-[a-z0-9]+\.webp$/);
      expect(filename.endsWith('.webp')).toBe(true);
    });
  });

  describe('getUploadSubfolder', () => {
    it('routes correctly based on URL paths', () => {
      expect(getUploadSubfolder('/api/catalog/materials')).toBe('materials');
      expect(getUploadSubfolder('/api/catalog/services/123')).toBe('services');
      expect(getUploadSubfolder('/api/assets')).toBe('assets');
      expect(getUploadSubfolder('/api/catalog/car-brands')).toBe('cars/brands');
      expect(getUploadSubfolder('/api/catalog/car-models')).toBe('cars/models');
      expect(getUploadSubfolder('/api/other')).toBe('misc');
    });
  });

  describe('processUploadedImage', () => {
    const createdFiles: string[] = [];

    afterAll(() => {
      // Clean up files created during test
      for (const f of createdFiles) {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch {
          // ignore
        }
      }
    });

    it('converts an image <= 200KB to WebP quality 85 without downscaling dimensions', async () => {
      // Create a small image (400x300, well under 200KB)
      const inputBuffer = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 3,
          background: { r: 50, g: 150, b: 200 },
        },
      })
        .jpeg({ quality: 80 })
        .toBuffer();

      expect(inputBuffer.length).toBeLessThan(SIZE_THRESHOLD_BYTES);

      const req = {
        originalUrl: '/api/catalog/materials',
        body: { itemCode: 'MAT-TEST1', nameEn: 'Small Sample' },
      } as any;

      const file = {
        buffer: inputBuffer,
        size: inputBuffer.length,
        originalname: 'small-sample.jpg',
        mimetype: 'image/jpeg',
      } as any;

      await processUploadedImage(req, file);
      createdFiles.push(file.path);

      expect(file.mimetype).toBe('image/webp');
      expect(file.filename.endsWith('.webp')).toBe(true);
      expect(fs.existsSync(file.path)).toBe(true);

      const metadata = await sharp(file.path).metadata();
      expect(metadata.format).toBe('webp');
      // Dimensions should remain untouched since <= 200KB
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(300);
    });

    it('normalizes dimensions to max 800px when original image > 200KB', async () => {
      // Create a large, high-frequency image that exceeds 200KB
      // 1600x1200 with random noise to ensure it exceeds 200KB uncompressed
      const rawPixels = Buffer.alloc(1600 * 1200 * 3);
      for (let i = 0; i < rawPixels.length; i += 3) {
        rawPixels[i] = (i * 13) % 256;
        rawPixels[i + 1] = (i * 29) % 256;
        rawPixels[i + 2] = (i * 47) % 256;
      }

      const inputBuffer = await sharp(rawPixels, {
        raw: { width: 1600, height: 1200, channels: 3 },
      })
        .png({ compressionLevel: 0 })
        .toBuffer();

      expect(inputBuffer.length).toBeGreaterThan(SIZE_THRESHOLD_BYTES);

      const req = {
        originalUrl: '/api/catalog/materials',
        body: { itemCode: 'MAT-TEST2', nameEn: 'Large Photo' },
      } as any;

      const file = {
        buffer: inputBuffer,
        size: inputBuffer.length,
        originalname: 'large-photo.png',
        mimetype: 'image/png',
      } as any;

      await processUploadedImage(req, file);
      createdFiles.push(file.path);

      expect(file.mimetype).toBe('image/webp');
      expect(file.filename.endsWith('.webp')).toBe(true);
      expect(fs.existsSync(file.path)).toBe(true);

      const metadata = await sharp(file.path).metadata();
      expect(metadata.format).toBe('webp');
      // 1600x1200 aspect ratio 4:3 normalized to max 800px -> 800x600
      expect(metadata.width).toBe(MAX_DIMENSION_PX);
      expect(metadata.height).toBe(600);
    });

    it('normalizes portrait images to max 800px height when > 200KB', async () => {
      // 1000x2000 image
      const rawPixels = Buffer.alloc(1000 * 2000 * 3);
      for (let i = 0; i < rawPixels.length; i += 3) {
        rawPixels[i] = (i * 7) % 256;
        rawPixels[i + 1] = (i * 19) % 256;
        rawPixels[i + 2] = (i * 31) % 256;
      }

      const inputBuffer = await sharp(rawPixels, {
        raw: { width: 1000, height: 2000, channels: 3 },
      })
        .png({ compressionLevel: 0 })
        .toBuffer();

      expect(inputBuffer.length).toBeGreaterThan(SIZE_THRESHOLD_BYTES);

      const req = {
        originalUrl: '/api/catalog/services',
        body: { nameEn: 'Tall Banner' },
      } as any;

      const file = {
        buffer: inputBuffer,
        size: inputBuffer.length,
        originalname: 'tall-banner.png',
        mimetype: 'image/png',
      } as any;

      await processUploadedImage(req, file);
      createdFiles.push(file.path);

      expect(file.mimetype).toBe('image/webp');
      const metadata = await sharp(file.path).metadata();
      expect(metadata.format).toBe('webp');
      // 1000x2000 normalized to max 800px -> 400x800
      expect(metadata.height).toBe(MAX_DIMENSION_PX);
      expect(metadata.width).toBe(400);
    });
  });
});

