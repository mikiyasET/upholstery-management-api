import prisma from '../../lib/prisma';

export class CustomersVehiclesService {
  static async searchCustomerByPhone(phone: string) {
    return prisma.customer.findUnique({
      where: { phoneNumber: phone },
      include: { vehicles: { include: { carModel: { include: { brand: true } } } } },
    });
  }

  static async getCustomers(search?: string) {
    return prisma.customer.findMany({
      where: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
          { vehicles: { some: { plateNumber: { contains: search, mode: 'insensitive' } } } }
        ]
      } : undefined,
      include: {
        vehicles: { include: { carModel: { include: { brand: true } } } },
        _count: { select: { orders: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        vehicles: { include: { carModel: { include: { brand: true } } } },
        orders: { 
          include: { 
            vehicle: { include: { carModel: { include: { brand: true } } } },
            serviceLines: true,
            standaloneLines: true,
            additionalCharges: true,
            assignments: { include: { employee: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!customer) return null;

    const ordersWithTotals = customer.orders.map(order => {
      let totalService = 0;
      for (const sl of order.serviceLines) {
        totalService += Number(sl.priceAtOrderTime || 0);
      }
      let totalStandalone = 0;
      for (const ml of order.standaloneLines) {
        totalStandalone += (Number(ml.quantity || 0) * Number(ml.priceAtOrderTime || 0));
      }
      let totalAdditional = 0;
      for (const ac of order.additionalCharges) {
        totalAdditional += Number(ac.price || 0);
      }
      const serviceFee = Number(order.serviceFee || 0);

      const subTotal = totalService + totalStandalone + totalAdditional + serviceFee;
      const totalDiscount = Number(order.discountAmount || 0);
      const taxAmount = Number(order.taxAmount || 0);
      const grandTotal = subTotal - totalDiscount + taxAmount;

      return {
        ...order,
        subTotal,
        grandTotal,
      };
    });

    return {
      ...customer,
      orders: ordersWithTotals,
    };
  }

  static async getVehicles(search?: string) {
    return prisma.vehicle.findMany({
      where: search ? {
        plateNumber: { contains: search, mode: 'insensitive' }
      } : undefined,
      include: {
        customer: true,
        carModel: { include: { brand: true } },
        _count: { select: { orders: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async resolveCustomerAndVehicle(data: { name: string; phone: string; plateNumber?: string; carModelId?: string }) {
    return prisma.$transaction(async (tx) => {
      // 1. Resolve Customer
      let customer = await tx.customer.findUnique({ where: { phoneNumber: data.phone } });
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name: data.name,
            phoneNumber: data.phone,
          },
        });
      } else if (customer.name !== data.name) {
        // Update customer name if changed
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: { name: data.name },
        });
      }

      // 2. Resolve Vehicle (if plate is provided)
      let vehicle = null;
      if (data.plateNumber && data.carModelId) {
        vehicle = await tx.vehicle.findUnique({ where: { plateNumber: data.plateNumber } });
        
        if (!vehicle) {
          vehicle = await tx.vehicle.create({
            data: {
              plateNumber: data.plateNumber,
              customerId: customer.id,
              carModelId: data.carModelId,
            },
          });
        } else if (vehicle.customerId !== customer.id || vehicle.carModelId !== data.carModelId) {
          // Update vehicle ownership or car model if changed
          vehicle = await tx.vehicle.update({
            where: { id: vehicle.id },
            data: {
              customerId: customer.id,
              carModelId: data.carModelId,
            }
          });
        }
      }

      return { customer, vehicle };
    });
  }

  static async getVehicleHistory(vehicleId: string) {
    return prisma.order.findMany({
      where: { vehicleId },
      include: {
        carStatuses: { include: { carStatus: true } },
        serviceLines: { include: { serviceCategory: { include: { service: true } } } },
        standaloneLines: { include: { material: true } },
      },
      orderBy: { orderDateTime: 'desc' },
    });
  }
}
