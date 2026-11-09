import express from 'express';
import cors from 'cors';
import path from 'path';
import 'express-async-errors';

import { errorHandler } from './middleware/error-handler';
import authRouter from './modules/auth/auth.router';
import catalogRouter from './modules/catalog/catalog.router';
import storageRouter from './modules/storage/storage.router';
import customersRouter from './modules/customers-vehicles/customers-vehicles.router';
import ordersRouter from './modules/orders/orders.router';
import directSalesRouter from './modules/direct-sales/direct-sales.router';
import usersRouter from './modules/users-employees/users.router';
import reportsRouter from './modules/reports/reports.router';
import assetsRouter from './modules/assets/assets.router';

const app = express();

app.use(cors());
app.use(express.json());

// Expose local uploads directly via static middleware
const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(UPLOADS_DIR)));

// Fallback for car assets: if an image is not found on local disk in /uploads/cars, redirect to Cloudflare R2
const R2_BASE = (process.env.R2_PUBLIC_BASE_URL || 'https://pub-09661d9805264d67ad957b15391bcffd.r2.dev').replace(/\/+$/, '');
app.use('/uploads/cars', (req, res) => {
  res.redirect(302, `${R2_BASE}${req.path}`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routers
app.use('/auth', authRouter);
app.use('/catalog', catalogRouter);
app.use('/storage', storageRouter);
app.use('/customers', customersRouter);
app.use('/orders', ordersRouter);
app.use('/direct-sales', directSalesRouter);
app.use('/users', usersRouter);
app.use('/reports', reportsRouter);
app.use('/assets', assetsRouter);

// Central error handler should be last
app.use(errorHandler);

export default app;
