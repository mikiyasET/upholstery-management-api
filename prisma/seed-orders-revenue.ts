import { PrismaClient, OrderStatus, PaymentStatus, PaymentMethod, StoreType, UserRole } from '@prisma/client';
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

async function main() {
  console.log('🚀 Starting Comprehensive Orders & Revenue Seeding...');

  // 1. Get or create Admin user
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    throw new Error('Admin user not found. Please run seed.ts first.');
  }

  // 2. Ensure Stores exist
  const miniStore = await prisma.store.upsert({
    where: { type: StoreType.MINI },
    update: {},
    create: { name: 'Mini Store (Floor)', type: StoreType.MINI },
  });

  // 3. Verify materials are seeded
  const materials = await prisma.material.findMany();
  if (materials.length === 0) {
    throw new Error('No materials found. Please run seed-catalog.ts first.');
  }

  // 4. Ensure Technicians exist as both Employee records and User (EMPLOYEE role) accounts
  console.log('👥 Creating workshop technicians & employee user profiles...');
  const employees: any[] = [];
  for (const tech of TECHNICIANS) {
    let emp = await prisma.employee.findFirst({
      where: { phone: tech.phone },
    });
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
        data: {
          name: tech.name,
          jobRoles: [tech.role],
          isActive: true,
        },
      });
    }

    // Ensure corresponding User account exists with role EMPLOYEE so they appear on Employees page and in assignment dropdowns
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
        passwordHash: null,
      },
    });

    employees.push({ ...emp, defaultRole: tech.role });
  }

  // 5. Get available Service Categories and Car Models
  const serviceCategories = await prisma.serviceCategory.findMany({
    include: { service: true },
  });
  if (serviceCategories.length === 0) {
    throw new Error('No service categories found. Run seed-catalog.ts first.');
  }

  const carModels = await prisma.carModel.findMany({ take: 30 });
  if (carModels.length === 0) {
    throw new Error('No car models found. Run seed.ts first.');
  }

  // 6. Create Customers and Vehicles
  console.log('🚗 Creating customer profiles & vehicle registry...');
  const customerVehicles: { customer: any; vehicle: any }[] = [];
  for (let i = 0; i < ETHIOPIAN_CUSTOMERS.length; i++) {
    const custData = ETHIOPIAN_CUSTOMERS[i];
    const customer = await prisma.customer.upsert({
      where: { phoneNumber: custData.phone },
      update: { name: custData.name },
      create: {
        name: custData.name,
        phoneNumber: custData.phone,
      },
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

  // 7. Seed Orders & Direct Sales across 30 days strictly ending on October 10, 2026
  console.log('🧹 Cleaning up previously seeded transactions...');
  await prisma.orderAssignment.deleteMany({
    where: { order: { orderNumber: { startsWith: 'ORD-26' } } },
  });
  await prisma.orderPayment.deleteMany({
    where: { order: { orderNumber: { startsWith: 'ORD-26' } } },
  });
  await prisma.orderServiceLine.deleteMany({
    where: { order: { orderNumber: { startsWith: 'ORD-26' } } },
  });
  await prisma.orderStandaloneItemLine.deleteMany({
    where: { order: { orderNumber: { startsWith: 'ORD-26' } } },
  });
  await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: 'ORD-26' } },
  });

  await prisma.directSalePayment.deleteMany({
    where: { directSale: { saleNumber: { startsWith: 'DS-26' } } },
  });
  await prisma.directSaleLine.deleteMany({
    where: { directSale: { saleNumber: { startsWith: 'DS-26' } } },
  });
  await prisma.directSale.deleteMany({
    where: { saleNumber: { startsWith: 'DS-26' } },
  });

  // Also clean up any orders or sales past Oct 10, 2026
  const oct11Cutoff = new Date('2026-10-10T23:59:59.999Z');
  await prisma.orderAssignment.deleteMany({
    where: { order: { orderDateTime: { gt: oct11Cutoff } } },
  });
  await prisma.orderPayment.deleteMany({
    where: { order: { orderDateTime: { gt: oct11Cutoff } } },
  });
  await prisma.orderServiceLine.deleteMany({
    where: { order: { orderDateTime: { gt: oct11Cutoff } } },
  });
  await prisma.orderStandaloneItemLine.deleteMany({
    where: { order: { orderDateTime: { gt: oct11Cutoff } } },
  });
  await prisma.order.deleteMany({
    where: { orderDateTime: { gt: oct11Cutoff } },
  });

  await prisma.directSalePayment.deleteMany({
    where: { directSale: { saleDateTime: { gt: oct11Cutoff } } },
  });
  await prisma.directSaleLine.deleteMany({
    where: { directSale: { saleDateTime: { gt: oct11Cutoff } } },
  });
  await prisma.directSale.deleteMany({
    where: { saleDateTime: { gt: oct11Cutoff } },
  });

  // Reset DailyStats ledger so historical stats are re-computed cleanly
  await prisma.dailyStats.deleteMany({});

  console.log('📅 Generating realistic transactions strictly ending on October 10, 2026 (never passing Oct 10)...');
  // Anchor date: October 10, 2026. The seed will never pass Oct 10.
  const anchorDate = new Date('2026-10-10T12:00:00.000Z');
  let orderCounter = 1000;
  let saleCounter = 5000;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const baseDate = subDays(anchorDate, dayOffset);
    const dateStr = DailyStatsService.formatDateKey(baseDate);

    // Determine how many orders today (1 to 3 orders)
    // Weekends (offset % 7 === 0 or 1) can have more activity
    const isWeekend = baseDate.getDay() === 0 || baseDate.getDay() === 6;
    const ordersTodayCount = isWeekend ? 3 : (dayOffset % 3 === 0 ? 3 : 2);
    const salesTodayCount = isWeekend ? 2 : (dayOffset % 2 === 0 ? 2 : 1);

    // --- Generate Orders ---
    for (let oIdx = 0; oIdx < ordersTodayCount; oIdx++) {
      orderCounter++;
      const cv = customerVehicles[(orderCounter + oIdx) % customerVehicles.length];
      const hours = 9 + (oIdx * 3);
      const minutes = (oIdx * 17) % 60;
      const orderDateTime = setMinutes(setHours(baseDate, hours), minutes);

      // Pick 1 to 2 services
      const cat1 = serviceCategories[(orderCounter + 1) % serviceCategories.length];
      const cat2 = (orderCounter % 2 === 0) ? serviceCategories[(orderCounter + 3) % serviceCategories.length] : null;

      const p1 = Number(cat1.price) || 1500;
      const p2 = cat2 ? (Number(cat2.price) || 1200) : 0;

      // Pick optional standalone item
      const standMat = materials[(orderCounter + 2) % materials.length];
      const standQty = 1;
      const standPrice = Number(standMat.currentPrice) || 1000;

      const subtotal = p1 + p2 + standPrice;
      const discount = (orderCounter % 5 === 0) ? 200 : 0;
      const tax = 0;
      const grandTotal = subtotal - discount + tax;

      // Status
      let orderStatus: OrderStatus = OrderStatus.DELIVERED;
      let paymentStatus: PaymentStatus = PaymentStatus.PAID;

      if (dayOffset === 0) {
        // Oct 10: latest day in seed
        orderStatus = oIdx === 0 ? OrderStatus.IN_PROGRESS : (oIdx === 1 ? OrderStatus.READY_FOR_PICKUP : OrderStatus.DELIVERED);
        paymentStatus = oIdx === 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID;
      } else {
        // Oct 9 and earlier
        orderStatus = OrderStatus.DELIVERED;
        paymentStatus = PaymentStatus.PAID;
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
          taxAmount: tax,
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
                quantity: standQty,
                priceAtOrderTime: standPrice,
              },
            ],
          },
        },
      });

      // Assignment
      const tech = employees[orderCounter % employees.length];
      await prisma.orderAssignment.create({
        data: {
          orderId: order.id,
          employeeId: tech.id,
          roleLabel: tech.defaultRole,
          assignedAt: orderDateTime,
        },
      });

      // Payment
      if (paymentStatus === PaymentStatus.PAID) {
        await prisma.orderPayment.create({
          data: {
            orderId: order.id,
            amount: grandTotal,
            method: (orderCounter % 3 === 0) ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH,
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

      const m1 = materials[(saleCounter) % materials.length];
      const m2 = materials[(saleCounter + 4) % materials.length];

      const q1 = (saleCounter % 2 === 0) ? 2 : 1;
      const q2 = 1;
      const pr1 = Number(m1.currentPrice) || 800;
      const pr2 = Number(m2.currentPrice) || 1000;

      const saleTotal = (q1 * pr1) + (q2 * pr2);
      const saleNumber = `DS-${dateStr.replace(/-/g, '').slice(2)}-${String(saleCounter).slice(-3)}`;

      const sale = await prisma.directSale.create({
        data: {
          saleNumber,
          saleDateTime,
          customerName: ETHIOPIAN_CUSTOMERS[(saleCounter) % ETHIOPIAN_CUSTOMERS.length].name,
          customerPhone: ETHIOPIAN_CUSTOMERS[(saleCounter) % ETHIOPIAN_CUSTOMERS.length].phone,
          paymentStatus: PaymentStatus.PAID,
          createdById: admin.id,
          lines: {
            create: [
              { materialId: m1.id, quantity: q1, priceAtSaleTime: pr1 },
              { materialId: m2.id, quantity: q2, priceAtSaleTime: pr2 },
            ],
          },
          payments: {
            create: [
              {
                amount: saleTotal,
                method: (saleCounter % 2 === 0) ? PaymentMethod.CASH : PaymentMethod.BANK_TRANSFER,
                paidAt: saleDateTime,
                recordedById: admin.id,
              },
            ],
          },
        },
      });
    }
  }

  // 8. Automatically synchronize DailyStats ledger table
  console.log('📊 Synchronizing pre-aggregated DailyStats database ledger...');
  const syncResult = await DailyStatsService.syncAllHistoricalStats();
  console.log(`✅ DailyStats synced successfully! Covered ${syncResult.syncedDays} days.`);

  console.log('🎉 Seeding completed successfully! The chart and dashboard are now fully populated.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
