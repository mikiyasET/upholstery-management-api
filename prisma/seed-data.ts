import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  StoreType,
  UserRole,
} from '@prisma/client';
import { subDays, setHours, setMinutes } from 'date-fns';
import { DailyStatsService } from '../app/modules/reports/daily-stats.service';

const prisma = new PrismaClient();

const ETHIOPIAN_CUSTOMERS = [
  { name: 'Abebe Kebede', phone: '0911223344', plate: '3-A12345' },
  { name: 'Almaz Bekele', phone: '0912345678', plate: '2-B23456' },
  { name: 'Dawit Haile', phone: '0913456789', plate: '3-B34567' },
  { name: 'Meron Tadesse', phone: '0914567890', plate: '3-C45678' },
  { name: 'Yohannes Assefa', phone: '0915678901', plate: '2-C56789' },
  { name: 'Betelhem Girma', phone: '0916789012', plate: '3-D67890' },
  { name: 'Selamawit Desta', phone: '0917890123', plate: '3-E78901' },
  { name: 'Henok Tesfaye', phone: '0918901234', plate: '2-E89012' },
  { name: 'Tigist Alemu', phone: '0919012345', plate: '3-F90123' },
  { name: 'Yared Berhanu', phone: '0920123456', plate: '3-G01234' },
  { name: 'Rahel Mengistu', phone: '0921234567', plate: '2-G12345' },
  { name: 'Samuel Worku', phone: '0922345678', plate: '3-H23456' },
  { name: 'Bethlehem Tefera', phone: '0923456789', plate: '3-J34567' },
  { name: 'Natnael Solomon', phone: '0924567890', plate: '2-K45678' },
  { name: 'Elias Kassaye', phone: '0925678901', plate: '3-L56789' },
];

const TECHNICIANS = [
  { name: 'Natnael Tadesse', phone: '0911000001', role: 'Seat Tailor' },
  { name: 'Kidus Solomon', phone: '0911000002', role: 'Dismantler' },
  { name: 'Ermias Haile', phone: '0911000003', role: 'Electrician' },
  { name: 'Biruk Girma', phone: '0911000004', role: 'Tint Specialist' },
  { name: 'Abel Bekele', phone: '0911000005', role: 'Floor Installer' },
];

const SUPPLIERS_SEED = [
  {
    name: 'Tana Auto Parts & Accessories Importer',
    phone: '0911445566',
    notes: 'Direct importer of accessories, electronics, GPS, and security kits',
  },
  {
    name: 'Addis Auto Care & Detailing Supplies',
    phone: '0911778899',
    notes: 'Shampoos, polishes, waxes, clay bars, and detailing pads',
  },
  {
    name: 'Merkato Chemical & Upholstery Wholesale',
    phone: '0912112233',
    notes: 'Floor mat rolls (1.40m, 1.60m), seat cushion fabrics, and cleaning chemicals',
  },
];

const WORKSHOP_ASSETS_SEED = [
  {
    assetTag: 'AST-0001',
    nameEn: 'Hydraulic 2-Post Vehicle Lift',
    nameAm: 'የመኪና ማንሻ ሃይድሮሊክ ሊፍት (2-ፖስት)',
    category: 'Heavy Equipment',
    location: 'Bay 1',
    quantity: 2,
    unit: 'PCS',
    description: '4-ton capacity clear-floor vehicle lift for underbody inspections and detailing',
  },
  {
    assetTag: 'AST-0002',
    nameEn: 'Rotary Polisher Dewalt DWP849X',
    nameAm: 'የፖሊሽ ማሽን (ዲዋልት DWP849X)',
    category: 'Power Tools',
    location: 'Detailing Bay',
    quantity: 4,
    unit: 'PCS',
    description: 'Variable speed rotary polisher with soft-start electronic control',
  },
  {
    assetTag: 'AST-0003',
    nameEn: 'Karcher Professional Steam Extractor SG 4/4',
    nameAm: 'የእንፋሎት ቫኪዩም ማሽን (ካርቸር SG 4/4)',
    category: 'Cleaning Equipment',
    location: 'Interior Bay',
    quantity: 2,
    unit: 'PCS',
    description: 'Commercial 4-bar pressure steam cleaner for deep upholstery and carpet extraction',
  },
  {
    assetTag: 'AST-0004',
    nameEn: 'Industrial Rotary Air Compressor 100L',
    nameAm: 'ኢንዱስትሪያል ኤር ኮምፕረሰር 100ሊ',
    category: 'Workshop Infrastructure',
    location: 'Utility Room',
    quantity: 1,
    unit: 'PCS',
    description: 'High-output 100-liter silent compressor powering pneumatic tools and blow guns',
  },
  {
    assetTag: 'AST-0005',
    nameEn: 'Digital Heat Gun Bosch GHG 20-63',
    nameAm: 'የቲንቲንግ ዲጂታል ሂት ጋን (ቦሽ)',
    category: 'Handheld Tools',
    location: 'Tint Bay',
    quantity: 3,
    unit: 'PCS',
    description: 'Precision digital temperature heat gun for window tinting and PPF shrink fitting',
  },
];

async function main() {
  console.log('🚀 Starting Comprehensive Test Data Seeding (seed:data)...');

  // 1. Ensure Admin User exists
  let admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Yonatan Admin',
        phone: '0911000000',
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
  }

  // 2. Ensure MAIN and MINI stores exist
  const mainStore = await prisma.store.upsert({
    where: { type: StoreType.MAIN },
    update: {},
    create: { name: 'Main Store (Warehouse)', type: StoreType.MAIN },
  });

  const miniStore = await prisma.store.upsert({
    where: { type: StoreType.MINI },
    update: {},
    create: { name: 'Mini Store (Floor)', type: StoreType.MINI },
  });

  // 3. Verify materials and services exist
  const materials = await prisma.material.findMany({
    include: { brands: true },
    orderBy: { itemCode: 'asc' },
  });

  if (materials.length === 0) {
    throw new Error('❌ No materials found in database. Please run "npm run seed:catalog" first.');
  }

  const serviceCategories = await prisma.serviceCategory.findMany({
    include: { service: true },
  });

  if (serviceCategories.length === 0) {
    throw new Error('❌ No service categories found in database. Please run "npm run seed:catalog" first.');
  }

  const carModels = await prisma.carModel.findMany({ take: 30 });
  if (carModels.length === 0) {
    throw new Error('❌ No car models found in database. Please run "npm run seed" first.');
  }

  // 4. Ensure Suppliers exist
  console.log('🏢 Seeding automotive suppliers...');
  const suppliers: any[] = [];
  for (const s of SUPPLIERS_SEED) {
    let sup = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!sup) {
      sup = await prisma.supplier.create({ data: s });
    }
    suppliers.push(sup);
  }

  // 5. Ensure Technicians exist as both Employee records and User profiles
  console.log('👥 Seeding workshop technicians & employee user profiles...');
  const employees: any[] = [];
  for (const tech of TECHNICIANS) {
    let emp = await prisma.employee.findFirst({ where: { phone: tech.phone } });
    if (!emp) {
      emp = await prisma.employee.create({
        data: {
          name: tech.name,
          phone: tech.phone,
          jobRoles: [tech.role],
          baseSalary: 9500,
          contactInfo: 'Full-time Workshop Technician',
          isActive: true,
        },
      });
    } else {
      emp = await prisma.employee.update({
        where: { id: emp.id },
        data: { name: tech.name, jobRoles: [tech.role], isActive: true },
      });
    }

    await prisma.user.upsert({
      where: { phone: tech.phone },
      update: {
        name: tech.name,
        role: UserRole.EMPLOYEE,
        employeeId: emp.id,
        isActive: true,
      },
      create: {
        name: tech.name,
        phone: tech.phone,
        role: UserRole.EMPLOYEE,
        employeeId: emp.id,
        isActive: true,
      },
    });

    employees.push({ ...emp, defaultRole: tech.role });
  }

  // 6. Ensure Customers & Vehicles exist
  console.log('🚗 Seeding customer profiles & vehicle registry...');
  const customerVehicles: { customer: any; vehicle: any }[] = [];
  for (let i = 0; i < ETHIOPIAN_CUSTOMERS.length; i++) {
    const custData = ETHIOPIAN_CUSTOMERS[i];
    const customer = await prisma.customer.upsert({
      where: { phoneNumber: custData.phone },
      update: { name: custData.name },
      create: { name: custData.name, phoneNumber: custData.phone },
    });

    const model = carModels[i % carModels.length];
    const vehicle = await prisma.vehicle.upsert({
      where: { plateNumber: custData.plate },
      update: { customerId: customer.id, carModelId: model.id },
      create: {
        plateNumber: custData.plate,
        customerId: customer.id,
        carModelId: model.id,
      },
    });

    customerVehicles.push({ customer, vehicle });
  }

  // 7. Seed Workshop Assets (Equipment)
  console.log('🛠️  Seeding workshop tools and infrastructure assets...');
  for (const assetData of WORKSHOP_ASSETS_SEED) {
    await prisma.asset.upsert({
      where: { assetTag: assetData.assetTag },
      update: {
        nameEn: assetData.nameEn,
        nameAm: assetData.nameAm,
        category: assetData.category,
        location: assetData.location,
        quantity: assetData.quantity,
        unit: assetData.unit,
        description: assetData.description,
        isDeleted: false,
      },
      create: {
        assetTag: assetData.assetTag,
        nameEn: assetData.nameEn,
        nameAm: assetData.nameAm,
        category: assetData.category,
        location: assetData.location,
        quantity: assetData.quantity,
        unit: assetData.unit,
        description: assetData.description,
        createdById: admin.id,
      },
    });
  }

  // 8. Populate Realistic Inventory Quantities for Materials and Brands/Variants
  console.log('📦 Seeding realistic inventory quantities for materials and brand variants...');

  // Low stock candidates to deliberately trigger low stock warnings for UI testing:
  // - MAT-0013: Fire Stop Extinguisher (Threshold: 5) -> Total: 3 (Main: 1, Mini: 2)
  // - MAT-0024: Side Mirror Wire (Threshold: 10) -> Total: 7 (Main: 4, Mini: 3)
  // - MAT-0037: Detailing Clay Bar (Threshold: 8) -> Total: 4 (Main: 2, Mini: 2)
  const LOW_STOCK_MAP: Record<string, { main: number; mini: number }> = {
    'MAT-0013': { main: 1, mini: 2 },
    'MAT-0024': { main: 4, mini: 3 },
    'MAT-0037': { main: 2, mini: 2 },
  };

  for (const mat of materials) {
    const isLowStockCandidate = LOW_STOCK_MAP[mat.itemCode];

    if (mat.brands && mat.brands.length > 0) {
      let totalMain = 0;
      let totalMini = 0;

      for (let bIdx = 0; bIdx < mat.brands.length; bIdx++) {
        const brand = mat.brands[bIdx];

        let bMainQty = 0;
        let bMiniQty = 0;

        if (isLowStockCandidate) {
          // Distribute the constrained low stock
          bMainQty = Math.max(1, Math.floor(isLowStockCandidate.main / mat.brands.length));
          bMiniQty = Math.max(1, Math.floor(isLowStockCandidate.mini / mat.brands.length));
        } else if (mat.isBulkTracked || mat.unit === 'METERS') {
          // Rolls / Meter-based materials (e.g. MAT-0036 Floor Mat Rolls)
          bMainQty = 40 + ((bIdx * 7) % 25); // 40m - 65m
          bMiniQty = 10 + ((bIdx * 3) % 15); // 10m - 25m
        } else {
          // Standard piece / pack / bottle items
          bMainQty = 15 + ((bIdx * 5) % 20); // 15 - 35 units
          bMiniQty = 4 + ((bIdx * 2) % 8);   // 4 - 12 units
        }

        totalMain += bMainQty;
        totalMini += bMiniQty;

        // Upsert MaterialBrandStock for MAIN store
        await prisma.materialBrandStock.upsert({
          where: {
            materialBrandId_storeId: {
              materialBrandId: brand.id,
              storeId: mainStore.id,
            },
          },
          update: { quantity: bMainQty },
          create: {
            materialBrandId: brand.id,
            storeId: mainStore.id,
            quantity: bMainQty,
          },
        });

        // Upsert MaterialBrandStock for MINI store
        await prisma.materialBrandStock.upsert({
          where: {
            materialBrandId_storeId: {
              materialBrandId: brand.id,
              storeId: miniStore.id,
            },
          },
          update: { quantity: bMiniQty },
          create: {
            materialBrandId: brand.id,
            storeId: miniStore.id,
            quantity: bMiniQty,
          },
        });
      }

      // Upsert aggregate MaterialStock for MAIN store
      await prisma.materialStock.upsert({
        where: {
          materialId_storeId: {
            materialId: mat.id,
            storeId: mainStore.id,
          },
        },
        update: { quantity: totalMain },
        create: {
          materialId: mat.id,
          storeId: mainStore.id,
          quantity: totalMain,
        },
      });

      // Upsert aggregate MaterialStock for MINI store
      await prisma.materialStock.upsert({
        where: {
          materialId_storeId: {
            materialId: mat.id,
            storeId: miniStore.id,
          },
        },
        update: { quantity: totalMini },
        create: {
          materialId: mat.id,
          storeId: miniStore.id,
          quantity: totalMini,
        },
      });
    } else {
      // Material without brands (universal)
      const mainQty = isLowStockCandidate ? isLowStockCandidate.main : 28;
      const miniQty = isLowStockCandidate ? isLowStockCandidate.mini : 8;

      await prisma.materialStock.upsert({
        where: {
          materialId_storeId: {
            materialId: mat.id,
            storeId: mainStore.id,
          },
        },
        update: { quantity: mainQty },
        create: {
          materialId: mat.id,
          storeId: mainStore.id,
          quantity: mainQty,
        },
      });

      await prisma.materialStock.upsert({
        where: {
          materialId_storeId: {
            materialId: mat.id,
            storeId: miniStore.id,
          },
        },
        update: { quantity: miniQty },
        create: {
          materialId: mat.id,
          storeId: miniStore.id,
          quantity: miniQty,
        },
      });
    }
  }
  console.log(`  ✓ Successfully updated stock quantities for all ${materials.length} materials across MAIN and MINI stores.`);

  // 9. Seed Realistic Stock Movement History (Restocks, Store Transfers, Stock Counts)
  console.log('📋 Seeding stock movement logs (Restocks, Transfers, Audits)...');

  // Purge old movement logs for clean idempotent rerun
  await prisma.restock.deleteMany({});
  await prisma.storeTransfer.deleteMany({});
  await prisma.stockCount.deleteMany({});

  const now = new Date();

  // Create 15 Restocks across the past 25 days
  for (let r = 0; r < 15; r++) {
    const mat = materials[r % materials.length];
    const sup = suppliers[r % suppliers.length];
    const brand = mat.brands.length > 0 ? mat.brands[r % mat.brands.length] : null;
    const rDate = subDays(now, 25 - r);
    const qty = mat.unit === 'METERS' ? 60 : 30;
    const unitCost = Number(brand?.price || mat.currentPrice || 500) * 0.65;

    await prisma.restock.create({
      data: {
        materialId: mat.id,
        materialBrandId: brand?.id || null,
        brandName: brand?.name || null,
        sizeName: brand?.size || null,
        colorName: brand?.color || null,
        typeName: brand?.type || null,
        storeId: mainStore.id,
        quantityAdded: qty,
        unitCost: Math.round(unitCost),
        supplierId: sup.id,
        purchaseDate: rDate,
        recordedById: admin.id,
      },
    });
  }

  // Create 8 Store Transfers from MAIN to MINI across the past 14 days
  const responsibleEmp = employees[employees.length - 1] || null;
  for (let t = 0; t < 8; t++) {
    const mat = materials[(t * 3) % materials.length];
    const brand = mat.brands.length > 0 ? mat.brands[0] : null;
    const tDate = subDays(now, 14 - t);
    const transQty = mat.unit === 'METERS' ? 15 : 8;

    await prisma.storeTransfer.create({
      data: {
        materialId: mat.id,
        materialBrandId: brand?.id || null,
        brandName: brand?.name || null,
        sizeName: brand?.size || null,
        colorName: brand?.color || null,
        typeName: brand?.type || null,
        fromStoreId: mainStore.id,
        toStoreId: miniStore.id,
        quantityTransferred: transQty,
        approvedById: admin.id,
        responsibleEmployeeId: responsibleEmp?.id || null,
        transferDate: tDate,
        notes: `Weekly floor restock for workshop station ${t + 1}`,
      },
    });
  }

  // Create 4 Stock Audit Counts
  for (let c = 0; c < 4; c++) {
    const mat = materials[(c * 4 + 1) % materials.length];
    const brand = mat.brands.length > 0 ? mat.brands[0] : null;
    const cDate = subDays(now, 7 - c);

    await prisma.stockCount.create({
      data: {
        storeId: miniStore.id,
        materialId: mat.id,
        materialBrandId: brand?.id || null,
        brandName: brand?.name || null,
        sizeName: brand?.size || null,
        colorName: brand?.color || null,
        typeName: brand?.type || null,
        countedQuantity: 10,
        systemQuantityAtCount: 10,
        discrepancy: 0,
        countedById: admin.id,
        countedAt: cDate,
        notes: 'Routine bi-weekly inventory audit check - 100% verified',
      },
    });
  }
  console.log('  ✓ Created 15 restocks, 8 transfers, and 4 audit counts.');

  // 10. Clean and Seed Orders & Direct Sales across past 30 days up to Today
  console.log('🧹 Resetting past transactions for clean test data...');
  await prisma.orderAssignment.deleteMany({});
  await prisma.orderPayment.deleteMany({});
  await prisma.orderServiceMaterialDeduction.deleteMany({});
  await prisma.orderServiceLine.deleteMany({});
  await prisma.orderStandaloneItemLine.deleteMany({});
  await prisma.orderCarStatus.deleteMany({});
  await prisma.order.deleteMany({});

  await prisma.directSalePayment.deleteMany({});
  await prisma.directSaleLine.deleteMany({});
  await prisma.directSale.deleteMany({});
  await prisma.dailyStats.deleteMany({});

  console.log('📅 Generating realistic Orders & Direct Sales across the past 30 days...');
  let orderCounter = 1000;
  let saleCounter = 5000;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const baseDate = subDays(now, dayOffset);
    const dateStr = DailyStatsService.formatDateKey(baseDate);

    const isWeekend = baseDate.getDay() === 0 || baseDate.getDay() === 6;
    const ordersTodayCount = isWeekend ? 3 : (dayOffset % 3 === 0 ? 3 : 2);
    const salesTodayCount = isWeekend ? 2 : (dayOffset % 2 === 0 ? 2 : 1);

    // --- Generate Work Orders ---
    for (let oIdx = 0; oIdx < ordersTodayCount; oIdx++) {
      orderCounter++;
      const cv = customerVehicles[(orderCounter + oIdx) % customerVehicles.length];
      const hours = 9 + (oIdx * 3);
      const minutes = (oIdx * 19) % 60;
      const orderDateTime = setMinutes(setHours(baseDate, hours), minutes);

      // Pick 1 or 2 services
      const cat1 = serviceCategories[(orderCounter + 1) % serviceCategories.length];
      const cat2 = (orderCounter % 2 === 0) ? serviceCategories[(orderCounter + 3) % serviceCategories.length] : null;

      const p1 = Number(cat1.price) || 2000;
      const p2 = cat2 ? (Number(cat2.price) || 1500) : 0;

      // Pick optional standalone item
      const standMat = materials[(orderCounter + 2) % materials.length];
      const standBrand = standMat.brands.length > 0 ? standMat.brands[0] : null;
      const standQty = 1;
      const standPrice = Number(standBrand?.price || standMat.currentPrice || 1000);

      const subtotal = p1 + p2 + standPrice;
      const discount = (orderCounter % 6 === 0) ? 200 : 0;
      const grandTotal = subtotal - discount;

      // Status logic:
      // Past days -> DELIVERED & PAID
      // Today (dayOffset === 0) -> 1 IN_PROGRESS, 1 READY_FOR_PICKUP, 1 PENDING/DELIVERED
      let orderStatus: OrderStatus = OrderStatus.DELIVERED;
      let paymentStatus: PaymentStatus = PaymentStatus.PAID;

      if (dayOffset === 0) {
        if (oIdx === 0) {
          orderStatus = OrderStatus.IN_PROGRESS;
          paymentStatus = PaymentStatus.PARTIALLY_PAID;
        } else if (oIdx === 1) {
          orderStatus = OrderStatus.READY_FOR_PICKUP;
          paymentStatus = PaymentStatus.PARTIALLY_PAID;
        } else {
          orderStatus = OrderStatus.OPEN;
          paymentStatus = PaymentStatus.UNPAID;
        }
      }

      const orderNumber = `ORD-${dateStr.replace(/-/g, '').slice(2)}-${String(orderCounter).slice(-3)}`;

      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId: cv.customer.id,
          vehicleId: cv.vehicle.id,
          orderDateTime,
          orderStatus,
          paymentStatus,
          discountAmount: discount,
          createdById: admin.id,
          serviceLines: {
            create: [
              {
                serviceCategoryId: cat1.id,
                priceAtOrderTime: p1,
              },
              ...(cat2 ? [{ serviceCategoryId: cat2.id, priceAtOrderTime: p2 }] : []),
            ],
          },
          standaloneLines: {
            create: [
              {
                materialId: standMat.id,
                materialBrandId: standBrand?.id || null,
                brandName: standBrand?.name || null,
                sizeName: standBrand?.size || null,
                colorName: standBrand?.color || null,
                typeName: standBrand?.type || null,
                quantity: standQty,
                priceAtOrderTime: standPrice,
              },
            ],
          },
        },
      });

      // Assign Technician
      const tech = employees[orderCounter % employees.length];
      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          employeeId: tech.id,
          roleLabel: tech.defaultRole,
          assignedAt: orderDateTime,
        },
      });

      // Payments
      if (paymentStatus === PaymentStatus.PAID) {
        await prisma.orderPayment.create({
          data: {
            orderId: order.id,
            amount: grandTotal,
            method: (orderCounter % 3 === 0) ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH,
            methodDetails: (orderCounter % 3 === 0) ? 'Commercial Bank of Ethiopia (CBE)' : 'Cash at counter',
            paidAt: orderDateTime,
            recordedById: admin.id,
          },
        });
      } else if (paymentStatus === PaymentStatus.PARTIALLY_PAID) {
        const deposit = Math.round(grandTotal * 0.5);
        await prisma.orderPayment.create({
          data: {
            orderId: order.id,
            amount: deposit,
            method: PaymentMethod.CASH,
            methodDetails: 'Advance cash deposit',
            paidAt: orderDateTime,
            recordedById: admin.id,
          },
        });
      }
    }

    // --- Generate Direct Sales ---
    for (let sIdx = 0; sIdx < salesTodayCount; sIdx++) {
      saleCounter++;
      const hours = 10 + (sIdx * 4);
      const minutes = (sIdx * 23) % 60;
      const saleDateTime = setMinutes(setHours(baseDate, hours), minutes);

      const m1 = materials[saleCounter % materials.length];
      const m2 = materials[(saleCounter + 4) % materials.length];

      const b1 = m1.brands.length > 0 ? m1.brands[0] : null;
      const b2 = m2.brands.length > 0 ? m2.brands[0] : null;

      const q1 = (saleCounter % 2 === 0) ? 2 : 1;
      const q2 = 1;
      const pr1 = Number(b1?.price || m1.currentPrice || 800);
      const pr2 = Number(b2?.price || m2.currentPrice || 1000);

      const saleTotal = (q1 * pr1) + (q2 * pr2);
      const saleNumber = `DS-${dateStr.replace(/-/g, '').slice(2)}-${String(saleCounter).slice(-3)}`;

      await prisma.directSale.create({
        data: {
          saleNumber,
          saleDateTime,
          customerName: ETHIOPIAN_CUSTOMERS[saleCounter % ETHIOPIAN_CUSTOMERS.length].name,
          customerPhone: ETHIOPIAN_CUSTOMERS[saleCounter % ETHIOPIAN_CUSTOMERS.length].phone,
          paymentStatus: PaymentStatus.PAID,
          createdById: admin.id,
          lines: {
            create: [
              {
                materialId: m1.id,
                materialBrandId: b1?.id || null,
                brandName: b1?.name || null,
                sizeName: b1?.size || null,
                colorName: b1?.color || null,
                typeName: b1?.type || null,
                quantity: q1,
                priceAtSaleTime: pr1,
              },
              {
                materialId: m2.id,
                materialBrandId: b2?.id || null,
                brandName: b2?.name || null,
                sizeName: b2?.size || null,
                colorName: b2?.color || null,
                typeName: b2?.type || null,
                quantity: q2,
                priceAtSaleTime: pr2,
              },
            ],
          },
          payments: {
            create: [
              {
                amount: saleTotal,
                method: (saleCounter % 3 === 0) ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH,
                methodDetails: (saleCounter % 3 === 0) ? 'Telebirr SuperApp transfer' : 'Cash on delivery',
                paidAt: saleDateTime,
                recordedById: admin.id,
              },
            ],
          },
        },
      });
    }
  }

  // 11. Synchronize DailyStats pre-aggregated database ledger
  console.log('📊 Synchronizing pre-aggregated DailyStats database ledger...');
  const syncResult = await DailyStatsService.syncAllHistoricalStats();
  console.log(`  ✓ DailyStats synced successfully! Covered ${syncResult.syncedDays} days.`);

  console.log('\n======================================================');
  console.log('🎉 SEED:DATA COMPLETE!');
  console.log('  ✓ 39 Materials populated with stock in MAIN & MINI stores');
  console.log('  ✓ Brands and size/type variants populated with distinct stock');
  console.log('  ✓ Low stock alerts generated for MAT-0013, MAT-0024, MAT-0037');
  console.log('  ✓ 15 Restocks, 8 Transfers, and 4 Stock Counts created');
  console.log('  ✓ 5 Workshop Assets seeded');
  console.log('  ✓ Work Orders and Direct Sales seeded across past 30 days');
  console.log('  ✓ Active Orders in progress and ready for pickup created for today');
  console.log('  ✓ Financial analytics and charts fully populated');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ seed:data failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

