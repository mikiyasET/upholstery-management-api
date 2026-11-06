import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // We could dynamically determine the subfolder based on the route or a req param
    // e.g. req.baseUrl.includes('materials') ? 'materials' : 'misc'
    let subfolder = 'misc';
    if (req.originalUrl.includes('materials')) subfolder = 'materials';
    if (req.originalUrl.includes('services')) subfolder = 'services';
    if (req.originalUrl.includes('assets')) subfolder = 'assets';
    if (req.originalUrl.includes('car-brands')) subfolder = 'cars/brands';
    else if (req.originalUrl.includes('car-models') || req.originalUrl.includes('cars')) subfolder = 'cars/models';

    const destPath = path.join(UPLOADS_DIR, subfolder);

    // Ensure the directory exists
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }

    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter,
});

