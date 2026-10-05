import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from 'generated/prisma/client';
import {
  CreateOrderBodyDto,
  CreateStorefrontOrderBodyDto,
  GetOrdersQueryDto,
  ImportOrdersBodyDto,
  OrderProductItemDto,
  UpdateOrderBodyDto
} from 'common/dto/order.dto';
import { PrismaService } from 'prisma/prisma.service';
import { Permission } from 'utils/enum';

@Injectable()
export class OrderService {
  /**
   * Constructs the OrderService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private readonly orderInclude = {
    createdBy: {
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        address: true,
        avatar: true,
        role: true
      }
    },
    customer: true,
    delivery: true,
    products: {
      include: {
        warehouse: true,
        productUnit: {
          include: {
            product: { include: { images: true, category: true } },
            unit: true
          }
        }
      },
      orderBy: { id: 'asc' as const }
    }
  };

  /**
   * Validates customer and delivery relation existence if IDs are provided.
   *
   * @param customerId Optional customer ID to check.
   * @param deliveryId Optional delivery partner ID to check.
   * @throws NotFoundException If specified customer or delivery partner does not exist.
   */
  private async validateRelations(customerId?: number, deliveryId?: number) {
    const [customer, delivery] = await Promise.all([
      customerId
        ? this.prisma.customer.findUnique({ where: { id: customerId } })
        : Promise.resolve(null),
      deliveryId
        ? this.prisma.delivery.findUnique({ where: { id: deliveryId } })
        : Promise.resolve(null)
    ]);

    if (customerId && !customer)
      throw new NotFoundException('message.order.customer-not-found');
    if (deliveryId && !delivery)
      throw new NotFoundException('message.order.delivery-not-found');
  }

  /**
   * Validates warehouse stock and decrements inventory for order items within a transaction.
   *
   * @param tx Prisma transaction client.
   * @param products Array of product items in the order.
   * @throws BadRequestException If duplicate items exist in payload or stock is insufficient.
   * @throws NotFoundException If a warehouse or product unit does not exist.
   */
  private async validateAndReduceStock(
    tx: Prisma.TransactionClient,
    products: OrderProductItemDto[]
  ) {
    const keys = new Set<string>();
    const productUnitKeys = new Set<string>();
    const warehouseIds = new Set<number>();

    for (const item of products) {
      const key = `${item.warehouseId ?? 'none'}-${item.productId}-${item.unitId}`;
      if (keys.has(key))
        throw new BadRequestException('message.order.product-duplicated');
      keys.add(key);
      productUnitKeys.add(`${item.productId}-${item.unitId}`);
      if (item.warehouseId) warehouseIds.add(item.warehouseId);
    }

    const [warehouses, productUnits] = await Promise.all([
      warehouseIds.size > 0
        ? tx.warehouse.findMany({
            where: { id: { in: [...warehouseIds] } },
            select: { id: true }
          })
        : Promise.resolve([]),
      tx.productUnit.findMany({
        where: {
          OR: products.map(({ productId, unitId }) => ({ productId, unitId }))
        },
        select: { productId: true, unitId: true }
      })
    ]);

    if (warehouses.length !== warehouseIds.size)
      throw new NotFoundException('message.order.warehouse-not-found');
    if (productUnits.length !== productUnitKeys.size)
      throw new NotFoundException('message.order.product-not-found');

    for (const item of products) {
      if (!item.warehouseId) continue;
      const result = await tx.warehouseProduct.updateMany({
        where: {
          warehouseId: item.warehouseId,
          productId: item.productId,
          unitId: item.unitId,
          quantity: { gte: item.quantity }
        },
        data: { quantity: { decrement: item.quantity } }
      });

      if (result.count === 0)
        throw new BadRequestException(
          'message.order.product-insufficient-stock'
        );
    }
  }

  /**
   * Restores warehouse stock when an order is updated or deleted within a transaction.
   *
   * @param tx Prisma transaction client.
   * @param products Array of product items containing warehouseId, productId, unitId, and quantity to increment.
   */
  private async restoreStock(
    tx: Prisma.TransactionClient,
    products: Array<{
      warehouseId: number | null;
      productId: number;
      unitId: number;
      quantity: number;
    }>
  ) {
    for (const item of products) {
      if (!item.warehouseId) continue;
      await tx.warehouseProduct.updateMany({
        where: {
          warehouseId: item.warehouseId,
          productId: item.productId,
          unitId: item.unitId
        },
        data: { quantity: { increment: item.quantity } }
      });
    }
  }

  /**
   * Maps DTO order product items to Prisma order product creation payloads.
   *
   * @param products Array of order product DTO items.
   * @returns Mapped order product item objects ready for database insertion.
   */
  private buildOrderProducts(products: OrderProductItemDto[]) {
    return products.map((item) => ({
      warehouseId: item.warehouseId,
      productId: item.productId,
      unitId: item.unitId,
      quantity: item.quantity,
      importPrice: item.importPrice,
      sellPrice: item.sellPrice,
      vatPercent: item.vatPercent
    }));
  }

  /** Calculates item margin minus the delivery cost after an order is completed. */
  private calculateOrderProfit(
    products: Array<{
      quantity: number;
      importPrice: number;
      sellPrice: number;
    }>,
    deliveryFee?: number | null
  ) {
    const itemMargin = products.reduce(
      (sum, item) =>
        sum +
        (Number(item.sellPrice) - Number(item.importPrice)) *
          Number(item.quantity),
      0
    );

    return Number((itemMargin - Number(deliveryFee ?? 0)).toFixed(2));
  }

  /**
   * Creates a new order, validates stock, reduces inventory, and attaches customer/delivery info.
   *
   * @param dto DTO containing order details (orderCode, customerId, deliveryId, products list, etc.).
   * @param creatorId ID of the account user creating the order.
   * @returns The created order with full inclusions.
   * @throws ConflictException If orderCode already exists.
   */
  async createOrder(dto: CreateOrderBodyDto, creatorId: number) {
    const { products, customerId, deliveryId, ...orderData } = dto;
    const existingOrder = await this.prisma.order.findUnique({
      where: { orderCode: dto.orderCode }
    });
    if (existingOrder)
      throw new ConflictException('message.order.order-code-duplicated');

    await this.validateRelations(customerId, deliveryId);
    return this.prisma.$transaction(async (tx) => {
      await this.validateAndReduceStock(tx, products);
      return tx.order.create({
        data: {
          ...orderData,
          profit:
            orderData.status === 'DONE'
              ? this.calculateOrderProfit(products, orderData.deliveryFee)
              : 0,
          customerId,
          deliveryId,
          creatorId,
          products: { create: this.buildOrderProducts(products) }
        },
        include: this.orderInclude
      });
    });
  }

  /** Atomically imports validated admin orders and their inventory deductions. */
  async importOrders(dto: ImportOrdersBodyDto, creatorId: number) {
    const orderCodes = dto.orders.map((order) => order.orderCode.trim());
    if (new Set(orderCodes).size !== orderCodes.length) {
      throw new ConflictException('message.order.order-code-duplicated');
    }

    const existingOrder = await this.prisma.order.findFirst({
      where: { orderCode: { in: orderCodes } },
      select: { orderCode: true }
    });
    if (existingOrder) {
      throw new ConflictException('message.order.order-code-duplicated');
    }

    await Promise.all(
      dto.orders.map((order) =>
        this.validateRelations(order.customerId, order.deliveryId)
      )
    );

    const items = await this.prisma.$transaction(
      async (tx) => {
        const imported: Array<{ id: number; orderCode: string }> = [];

        for (const order of dto.orders) {
          const { products, customerId, deliveryId, ...rawOrderData } = order;
          const orderData = {
            ...rawOrderData,
            orderCode: rawOrderData.orderCode.trim()
          };
          await this.validateAndReduceStock(tx, products);
          const created = await tx.order.create({
            data: {
              ...orderData,
              profit:
                orderData.status === 'DONE'
                  ? this.calculateOrderProfit(products, orderData.deliveryFee)
                  : 0,
              customerId,
              deliveryId,
              creatorId,
              products: { create: this.buildOrderProducts(products) }
            },
            select: { id: true, orderCode: true }
          });
          imported.push(created);
        }

        return imported;
      },
      { maxWait: 5_000, timeout: 30_000 }
    );

    return { importedCount: items.length, items };
  }

  private async getStorefrontCreator() {
    const configuredId = Number(
      this.config.get<string>('STOREFRONT_CREATOR_ID')
    );
    if (Number.isInteger(configuredId) && configuredId > 0) {
      const account = await this.prisma.account.findFirst({
        where: { id: configuredId, isActive: true },
        select: { id: true, warehouseId: true }
      });
      if (!account) {
        throw new ServiceUnavailableException(
          'message.storefront.creator-not-found'
        );
      }
      return account;
    }

    const account = await this.prisma.account.findFirst({
      where: {
        isActive: true,
        role: {
          isActive: true,
          permissions: { has: Permission.MANAGE_SALES }
        }
      },
      orderBy: { id: 'asc' },
      select: { id: true, warehouseId: true }
    });

    if (!account) {
      throw new ServiceUnavailableException(
        'message.storefront.creator-not-found'
      );
    }
    return account;
  }

  /** Creates a pending customer order using server prices and live warehouse stock. */
  async createStorefrontOrder(dto: CreateStorefrontOrderBodyDto) {
    const creator = await this.getStorefrontCreator();
    const itemKeys = dto.products.map(
      (item) => `${item.productId}-${item.unitId}`
    );
    if (new Set(itemKeys).size !== itemKeys.length) {
      throw new BadRequestException('message.order.product-duplicated');
    }

    const productUnits = await this.prisma.productUnit.findMany({
      where: {
        OR: dto.products.map(({ productId, unitId }) => ({
          productId,
          unitId
        })),
        product: { isActive: true },
        unit: { isActive: true }
      },
      select: {
        productId: true,
        unitId: true,
        importPrice: true,
        sellPrice: true,
        vatPercent: true
      }
    });

    if (productUnits.length !== dto.products.length) {
      throw new NotFoundException('message.order.product-not-found');
    }

    const unitMap = new Map(
      productUnits.map((unit) => [`${unit.productId}-${unit.unitId}`, unit])
    );
    const customerEmail = dto.customerEmail?.trim().toLowerCase() || undefined;
    const orderCode = `WEB-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const orderProducts: OrderProductItemDto[] = [];

      for (const item of dto.products) {
        const unit = unitMap.get(`${item.productId}-${item.unitId}`)!;
        const stockOptions = await tx.warehouseProduct.findMany({
          where: {
            productId: item.productId,
            unitId: item.unitId,
            quantity: { gte: item.quantity },
            warehouse: { isActive: true }
          },
          orderBy: { quantity: 'desc' },
          select: { warehouseId: true }
        });
        const stock =
          stockOptions.find(
            (option) => option.warehouseId === creator.warehouseId
          ) ?? stockOptions[0];

        if (!stock) {
          throw new BadRequestException(
            'message.order.product-insufficient-stock'
          );
        }

        const reduced = await tx.warehouseProduct.updateMany({
          where: {
            warehouseId: stock.warehouseId,
            productId: item.productId,
            unitId: item.unitId,
            quantity: { gte: item.quantity }
          },
          data: { quantity: { decrement: item.quantity } }
        });
        if (reduced.count === 0) {
          throw new BadRequestException(
            'message.order.product-insufficient-stock'
          );
        }

        orderProducts.push({
          ...item,
          warehouseId: stock.warehouseId,
          importPrice: unit.importPrice,
          sellPrice: unit.sellPrice,
          vatPercent: unit.vatPercent
        });
      }

      const totalAmount = Number(
        orderProducts
          .reduce((sum, item) => sum + item.sellPrice * item.quantity, 0)
          .toFixed(2)
      );
      const vatValue = Number(
        orderProducts
          .reduce(
            (sum, item) =>
              sum + (item.sellPrice * item.quantity * item.vatPercent) / 100,
            0
          )
          .toFixed(2)
      );
      const existingCustomer = await tx.customer.findFirst({
        where: {
          OR: [
            { phone: dto.customerPhone },
            ...(customerEmail ? [{ email: customerEmail }] : [])
          ]
        },
        select: { id: true }
      });

      return tx.order.create({
        data: {
          orderCode,
          customerId: existingCustomer?.id,
          customerName: dto.customerName.trim(),
          customerEmail,
          customerPhone: dto.customerPhone,
          customerAddress: dto.customerAddress.trim(),
          customerPayment: 0,
          vatValue,
          discountValue: 0,
          totalAmount,
          deliveryFee: 0,
          paidAmount: 0,
          status: 'PENDING',
          creatorId: creator.id,
          products: { create: this.buildOrderProducts(orderProducts) }
        },
        select: {
          id: true,
          orderCode: true,
          status: true,
          totalAmount: true,
          vatValue: true,
          deliveryFee: true,
          createdAt: true
        }
      });
    });

    return {
      ...order,
      payableAmount: Number(
        (order.totalAmount + order.vatValue + (order.deliveryFee ?? 0)).toFixed(
          2
        )
      )
    };
  }

  /**
   * Retrieves a paginated list of orders matching search terms and status filters.
   *
   * @param query DTO containing page, limit, status filter, and search query string.
   * @returns Paginated result containing order items and pagination metadata.
   */
  async findAllOrder(query: GetOrdersQueryDto) {
    const trimmedSearch = query.search?.trim();
    const { page = 1, limit = 10, status, from, to } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {})
            }
          }
        : {}),
      ...(trimmedSearch
        ? {
            OR: [
              {
                orderCode: {
                  contains: trimmedSearch,
                  mode: 'insensitive' as const
                }
              },
              {
                customerName: {
                  contains: trimmedSearch,
                  mode: 'insensitive' as const
                }
              },
              {
                customerPhone: {
                  contains: trimmedSearch,
                  mode: 'insensitive' as const
                }
              }
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      }
    };
  }

  /**
   * Retrieves an order by its unique ID.
   *
   * @param id The unique identifier of the order.
   * @returns The order entity with full relation inclusions.
   * @throws NotFoundException If the order is not found.
   */
  async findOrderById(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude
    });
    if (!order) throw new NotFoundException('message.order.not-found');
    return order;
  }

  /**
   * Updates an existing order, recalculating stock adjustments if product items are modified.
   *
   * @param id The unique identifier of the order to update.
   * @param dto DTO containing fields to update in the order.
   * @returns The updated order entity with full inclusions.
   * @throws NotFoundException If the order is not found.
   * @throws ConflictException If the updated orderCode belongs to another order.
   */
  async updateOrder(id: number, dto: UpdateOrderBodyDto) {
    const currentOrder = await this.prisma.order.findUnique({
      where: { id },
      select: {
        customerId: true,
        deliveryId: true,
        products: {
          select: {
            productId: true,
            unitId: true,
            quantity: true,
            importPrice: true,
            sellPrice: true,
            vatPercent: true,
            warehouseId: true
          }
        },
        totalAmount: true,
        vatValue: true,
        discountValue: true,
        deliveryFee: true,
        status: true
      }
    });
    if (!currentOrder) throw new NotFoundException('message.order.not-found');
    const { products, customerId, deliveryId, ...orderData } = dto;

    if (dto.orderCode) {
      const existingOrder = await this.prisma.order.findFirst({
        where: { orderCode: dto.orderCode, NOT: { id } }
      });
      if (existingOrder)
        throw new ConflictException('message.order.order-code-duplicated');
    }

    await this.validateRelations(
      customerId === undefined
        ? (currentOrder.customerId ?? undefined)
        : customerId,
      deliveryId === undefined
        ? (currentOrder.deliveryId ?? undefined)
        : deliveryId
    );

    return this.prisma.$transaction(async (tx) => {
      if (products) {
        await this.restoreStock(tx, currentOrder.products);
        await this.validateAndReduceStock(tx, products);
        await tx.orderProduct.deleteMany({ where: { orderId: id } });
        await tx.orderProduct.createMany({
          data: this.buildOrderProducts(products).map((item) => ({
            ...item,
            orderId: id
          }))
        });
      }

      const nextStatus = orderData.status ?? currentOrder.status;
      const profitData =
        nextStatus === 'DONE'
          ? {
              profit: this.calculateOrderProfit(
                products ?? currentOrder.products,
                orderData.deliveryFee ?? currentOrder.deliveryFee
              )
            }
          : currentOrder.status === 'DONE'
            ? { profit: 0 }
            : {};

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          ...orderData,
          ...(customerId !== undefined ? { customerId } : {}),
          ...(deliveryId !== undefined ? { deliveryId } : {}),
          ...profitData
        },
        include: this.orderInclude
      });

      return updatedOrder;
    });
  }

  /**
   * Deletes an order by ID and restores inventory stock for its products.
   *
   * @param id The unique identifier of the order to remove.
   * @returns The deleted order entity.
   * @throws NotFoundException If the order is not found.
   */
  async removeOrder(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { products: true }
    });
    if (!order) throw new NotFoundException('message.order.not-found');
    return this.prisma.$transaction(async (tx) => {
      await this.restoreStock(tx, order.products);
      await tx.orderProduct.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }
}
