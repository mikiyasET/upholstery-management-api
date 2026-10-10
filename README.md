# Yonatan-Upholstery-API

Backend REST API for the **Yonatan Car Decor & Upholstery POS & Inventory Management System**. Built with Express, TypeScript, and Prisma ORM on PostgreSQL.

## Features
- **Authentication & RBAC**: JWT access/refresh token system with granular role-based permissions (Admin, Storekeeper, Cashier, Reception, Tailor, Technician).
- **Inventory & Dual-Store Tracking**: Main Storage vs Mini Storage, stock transfers, batch tracking, and threshold alerts.
- **Service & Order Workflow**: Multi-status workflow (Pending, In Progress, Ready, Completed, Delivered) with vehicle condition inspection checklists.
- **Direct Sales & POS**: Direct retail sales of accessories and materials with instant stock deduction and receipts.
- **Reporting**: Revenue, top services, inventory valuation, and staff workload analytics.

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- npm or pnpm

### Environment Setup
Copy the sample environment file and adjust your settings:
```bash
cp .env.example .env
```

### Installation
```bash
npm install
```

### Database Migration & Seeding
```bash
npx prisma db push
npm run seed:all
```

### Development Server
```bash
npm run dev
```
Server runs by default at `http://localhost:3000`.

### Production Build
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t yonatan-upholstery-api .
docker run -p 3000:3000 --env-file .env yonatan-upholstery-api
```
