import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { UpdateOrderBodyDto } from 'common/dto/order.dto';
import type { PrismaService } from 'prisma/prisma.service';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: class PrismaService {}
}));

import { OrderService } from './order.service';

type WarehouseUpdateArgs = {
  where: {
    quantity: { gte: number };
  };
  data: {
    quantity: { decrement: number };
  };
};

type OrderCreateArgs = {
  data: {
    orderCode: string;
    status: string;
    totalAmount: number;
    vatValue: number;
    deliveryFee: number;
    customerEmail?: string;
    customerPayment?: number;
  };
};

describe('OrderService storefront checkout', () => {
  const dto = {
    customerName: 'Lan Nguyen',
    customerEmail: 'LAN@example.com',
    customerPhone: '0912345678',
    customerAddress: '1 Nguyen Hue, HCMC',
    products: [{ productId: 10, unitId: 2, quantity: 2 }]
  };

  const createService = (stockAvailable = true) => {
    const warehouseUpdates: WarehouseUpdateArgs[] = [];
    const orderCreates: OrderCreateArgs[] = [];
    const tx = {
      warehouseProduct: {
        findMany: jest
          .fn()
          .mockResolvedValue(stockAvailable ? [{ warehouseId: 3 }] : []),
        updateMany: jest.fn((args: WarehouseUpdateArgs) => {
          warehouseUpdates.push(args);
          return Promise.resolve({ count: 1 });
        })
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 7 })
      },
      order: {
        create: jest.fn().mockImplementation((args: OrderCreateArgs) => {
          orderCreates.push(args);
          const { data } = args;
          return {
            id: 1,
            orderCode: data.orderCode,
            status: data.status,
            totalAmount: data.totalAmount,
            vatValue: data.vatValue,
            deliveryFee: data.deliveryFee,
            createdAt: new Date('2026-01-01T00:00:00Z')
          };
        })
      }
    };
    const prisma = {
      account: {
        findFirst: jest.fn().mockResolvedValue({ id: 4, warehouseId: 3 })
      },
      productUnit: {
        findMany: jest.fn().mockResolvedValue([
          {
            productId: 10,
            unitId: 2,
            importPrice: 60,
            sellPrice: 100,
            vatPercent: 10
          }
        ])
      },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => unknown): unknown => callback(tx)
      )
    };
    const config = { get: jest.fn().mockReturnValue(undefined) };

    return {
      service: new OrderService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService
      ),
      tx,
      warehouseUpdates,
      orderCreates
    };
  };

  it('uses server prices, computes VAT, and deducts stock', async () => {
    const { service, warehouseUpdates, orderCreates } = createService();

    const result = await service.createStorefrontOrder(dto);

    const warehouseUpdate = warehouseUpdates[0];
    expect(warehouseUpdate).toMatchObject({
      where: { quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } }
    });

    const orderCreate = orderCreates[0];
    expect(orderCreate).toMatchObject({
      data: {
        customerEmail: 'lan@example.com',
        totalAmount: 200,
        vatValue: 20,
        customerPayment: 0,
        status: 'PENDING'
      }
    });
    expect(orderCreate.data).not.toHaveProperty('profit');
    expect(result.payableAmount).toBe(220);
  });

  it('rejects checkout when no warehouse can fulfill an item', async () => {
    const { service, tx } = createService(false);

    await expect(service.createStorefrontOrder(dto)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});

describe('OrderService profit finalization', () => {
  const createService = (status: 'PENDING' | 'DONE' = 'PENDING') => {
    const orderUpdates: Array<{ data: Record<string, unknown> }> = [];
    const currentOrder = {
      customerId: null,
      deliveryId: null,
      products: [
        {
          productId: 10,
          unitId: 2,
          quantity: 3,
          importPrice: 60,
          sellPrice: 100,
          vatPercent: 0,
          warehouseId: null
        }
      ],
      totalAmount: 300,
      vatValue: 0,
      discountValue: 0,
      deliveryFee: 40,
      status
    };
    const tx = {
      order: {
        update: jest.fn((args: { data: Record<string, unknown> }) => {
          orderUpdates.push(args);
          return Promise.resolve({
            id: 1,
            ...currentOrder,
            ...args.data
          });
        })
      }
    };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(currentOrder)
      },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => unknown): unknown => callback(tx)
      )
    };
    const config = { get: jest.fn() };

    return {
      service: new OrderService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService
      ),
      orderUpdates
    };
  };

  it('stores sell price minus import price and delivery fee when an order becomes done', async () => {
    const { service, orderUpdates } = createService();

    const result = await service.updateOrder(1, {
      status: 'DONE'
    } as UpdateOrderBodyDto);

    expect(orderUpdates[0].data).toMatchObject({ profit: 80 });
    expect(result.profit).toBe(80);
  });

  it('does not update profit while an order is not done', async () => {
    const { service, orderUpdates } = createService();

    await service.updateOrder(1, {
      deliveryFee: 50
    } as UpdateOrderBodyDto);

    expect(orderUpdates[0].data).not.toHaveProperty('profit');
  });

  it('clears profit when a completed order is reopened', async () => {
    const { service, orderUpdates } = createService('DONE');

    await service.updateOrder(1, {
      status: 'DELIVERING'
    } as UpdateOrderBodyDto);

    expect(orderUpdates[0].data).toMatchObject({ profit: 0 });
  });
});

describe('OrderService date-range filtering', () => {
  it('passes the requested inclusive date range to Prisma', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      order: { findMany, count },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations)
      )
    };
    const config = { get: jest.fn() };
    const service = new OrderService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService
    );

    await service.findAllOrder({
      page: 1,
      limit: 100,
      status: 'DONE',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.999Z'
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'DONE',
          createdAt: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lte: new Date('2026-09-30T23:59:59.999Z')
          }
        }
      })
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        status: 'DONE',
        createdAt: {
          gte: new Date('2026-09-01T00:00:00.000Z'),
          lte: new Date('2026-09-30T23:59:59.999Z')
        }
      }
    });
  });
});
