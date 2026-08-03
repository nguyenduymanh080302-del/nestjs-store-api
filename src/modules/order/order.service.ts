import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import {
    CreateOrderBodyDto,
    GetOrdersQueryDto,
    OrderProductItemDto,
    UpdateOrderBodyDto,
} from 'common/dto/order.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class OrderService {
    /**
     * Constructs the OrderService instance.
     *
     * @param prisma Database service instance for Prisma ORM.
     */
    constructor(private readonly prisma: PrismaService) { }

    private readonly orderInclude = {
        createdBy: {
            select: {
                id: true, name: true, username: true, email: true, phone: true,
                address: true, avatar: true, role: true,
            },
        },
        customer: true,
        delivery: true,
        products: {
            include: {
                warehouse: true,
                productUnit: {
                    include: {
                        product: { include: { images: true, category: true } },
                        unit: true,
                    },
                },
            },
            orderBy: { id: 'asc' as const },
        },
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
            customerId ? this.prisma.customer.findUnique({ where: { id: customerId } }) : Promise.resolve(null),
            deliveryId ? this.prisma.delivery.findUnique({ where: { id: deliveryId } }) : Promise.resolve(null),
        ]);

        if (customerId && !customer) throw new NotFoundException('message.order.customer-not-found');
        if (deliveryId && !delivery) throw new NotFoundException('message.order.delivery-not-found');
    }

    /**
     * Validates warehouse stock and decrements inventory for order items within a transaction.
     *
     * @param tx Prisma transaction client.
     * @param products Array of product items in the order.
     * @throws BadRequestException If duplicate items exist in payload or stock is insufficient.
     * @throws NotFoundException If a warehouse or product unit does not exist.
     */
    private async validateAndReduceStock(tx: Prisma.TransactionClient, products: OrderProductItemDto[]) {
        const keys = new Set<string>();
        const warehouseIds = new Set<number>();

        for (const item of products) {
            if (!item.warehouseId) continue;
            const key = `${item.warehouseId}-${item.productId}-${item.unitId}`;
            if (keys.has(key)) throw new BadRequestException('message.order.product-duplicated');
            keys.add(key);
            warehouseIds.add(item.warehouseId);
        }

        const [warehouses, productUnits] = await Promise.all([
            warehouseIds.size > 0
                ? tx.warehouse.findMany({ where: { id: { in: [...warehouseIds] } }, select: { id: true } })
                : Promise.resolve([]),
            tx.productUnit.findMany({
                where: { OR: products.map(({ productId, unitId }) => ({ productId, unitId })) },
                select: { productId: true, unitId: true },
            }),
        ]);

        if (warehouses.length !== warehouseIds.size) throw new NotFoundException('message.order.warehouse-not-found');
        if (productUnits.length !== products.length) throw new NotFoundException('message.order.product-not-found');

        for (const item of products) {
            if (!item.warehouseId) continue;
            const result = await tx.warehouseProduct.updateMany({
                where: {
                    warehouseId: item.warehouseId,
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: { gte: item.quantity },
                },
                data: { quantity: { decrement: item.quantity } },
            });

            if (result.count === 0) throw new BadRequestException('message.order.product-insufficient-stock');
        }
    }

    /**
     * Restores warehouse stock when an order is updated or deleted within a transaction.
     *
     * @param tx Prisma transaction client.
     * @param products Array of product items containing warehouseId, productId, unitId, and quantity to increment.
     */
    private async restoreStock(tx: Prisma.TransactionClient, products: Array<{ warehouseId: number | null; productId: number; unitId: number; quantity: number }>) {
        for (const item of products) {
            if (!item.warehouseId) continue;
            await tx.warehouseProduct.updateMany({
                where: { warehouseId: item.warehouseId, productId: item.productId, unitId: item.unitId },
                data: { quantity: { increment: item.quantity } },
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
            extraPrice: item.extraPrice ?? 0,
            vatPercent: item.vatPercent,
        }));
    }

    /**
     * Calculates store profit from a sale order using the product import cost base.
     *
     * @param order A sale order object containing total, VAT, discount, and products.
     * @returns The computed store profit value rounded to two decimals.
     */
    private calculateOrderProfit(order: {
        totalAmount: number;
        vatValue: number;
        discountValue?: number | null;
        products?: Array<{ quantity: number; importPrice?: number | null; productUnit?: { importPrice?: number | null } }>;
    }) {
        const importCost = (order.products || []).reduce((sum, item) => {
            const quantity = Number(item.quantity || 0);
            const importPrice = Number(item.importPrice ?? item.productUnit?.importPrice ?? 0);
            return sum + (quantity * importPrice);
        }, 0);

        return Number((
            Number(order.totalAmount || 0)
            + Number(order.vatValue || 0)
            - Number(order.discountValue || 0)
            - importCost
        ).toFixed(2));
    }

    /**
     * Builds a normalized order payload containing the computed store profit field before persistence.
     *
     * @param tx Prisma transaction client used for lookup operations.
     * @param orderData Order fields from the request body.
     * @param products Array of order product DTOs used to calculate import cost.
     * @returns An order payload object with the profit value attached.
     */
    private buildOrderProfitPayload(
        orderData: { totalAmount: number; vatValue: number; discountValue?: number | null },
        products: OrderProductItemDto[],
    ) {
        const importCost = products.reduce((sum, item) => {
            const quantity = Number(item.quantity || 0);
            const importPrice = Number(item.importPrice || 0);
            return sum + (quantity * importPrice);
        }, 0);

        const profit = Number((
            Number(orderData.totalAmount || 0)
            + Number(orderData.vatValue || 0)
            - Number(orderData.discountValue || 0)
            - importCost
        ).toFixed(2));

        return { profit };
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
        const existingOrder = await this.prisma.order.findUnique({ where: { orderCode: dto.orderCode } });
        if (existingOrder) throw new ConflictException('message.order.order-code-duplicated');

        await this.validateRelations(customerId, deliveryId);
        return this.prisma.$transaction(async (tx) => {
            await this.validateAndReduceStock(tx, products);
            const { profit } = this.buildOrderProfitPayload(orderData, products);
            const createdOrder = await tx.order.create({
                data: {
                    ...orderData,
                    customerId,
                    deliveryId,
                    creatorId,
                    profit,
                    products: { create: this.buildOrderProducts(products) },
                },
                include: this.orderInclude,
            });

            return {
                ...createdOrder,
                profit: this.calculateOrderProfit({ ...createdOrder, products: createdOrder.products }),
            };
        });
    }

    /**
     * Retrieves a paginated list of orders matching search terms and status filters.
     *
     * @param query DTO containing page, limit, status filter, and search query string.
     * @returns Paginated result containing order items and pagination metadata.
     */
    async findAllOrder(query: GetOrdersQueryDto) {
        const trimmedSearch = query.search?.trim();
        const { page = 1, limit = 10, status } = query;
        const skip = (page - 1) * limit;
        const where = {
            ...(status ? { status } : {}),
            ...(trimmedSearch ? {
                OR: [
                    { orderCode: { contains: trimmedSearch, mode: 'insensitive' as const } },
                    { customerName: { contains: trimmedSearch, mode: 'insensitive' as const } },
                    { customerPhone: { contains: trimmedSearch, mode: 'insensitive' as const } },
                ],
            } : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.order.findMany({ where, include: this.orderInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
            this.prisma.order.count({ where }),
        ]);

        const enrichedItems = items.map((item) => ({
            ...item,
            profit: this.calculateOrderProfit(item),
        }));

        return { items: enrichedItems, pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) } };
    }

    /**
     * Retrieves an order by its unique ID.
     *
     * @param id The unique identifier of the order.
     * @returns The order entity with full relation inclusions.
     * @throws NotFoundException If the order is not found.
     */
    async findOrderById(id: number) {
        const order = await this.prisma.order.findUnique({ where: { id }, include: this.orderInclude });
        if (!order) throw new NotFoundException('message.order.not-found');
        return {
            ...order,
            profit: this.calculateOrderProfit(order),
        };
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
                        warehouseId: true,
                        extraPrice: true,
                    },
                },
                totalAmount: true,
                vatValue: true,
                discountValue: true,
            },
        });
        if (!currentOrder) throw new NotFoundException('message.order.not-found');
        const { products, customerId, deliveryId, ...orderData } = dto;

        if (dto.orderCode) {
            const existingOrder = await this.prisma.order.findFirst({ where: { orderCode: dto.orderCode, NOT: { id } } });
            if (existingOrder) throw new ConflictException('message.order.order-code-duplicated');
        }

        await this.validateRelations(
            customerId === undefined ? currentOrder.customerId ?? undefined : customerId,
            deliveryId === undefined ? currentOrder.deliveryId ?? undefined : deliveryId,
        );

        return this.prisma.$transaction(async (tx) => {
            if (products) {
                await this.restoreStock(tx, currentOrder.products);
                await this.validateAndReduceStock(tx, products);
                await tx.orderProduct.deleteMany({ where: { orderId: id } });
                await tx.orderProduct.createMany({ data: this.buildOrderProducts(products).map((item) => ({ ...item, orderId: id })) });
            }

            const { profit } = this.buildOrderProfitPayload(
                {
                    totalAmount: Number(orderData.totalAmount ?? currentOrder.totalAmount ?? 0),
                    vatValue: Number(orderData.vatValue ?? currentOrder.vatValue ?? 0),
                    discountValue: orderData.discountValue ?? currentOrder.discountValue ?? 0,
                },
                products || currentOrder.products.map((item) => ({
                    productId: item.productId,
                    unitId: item.unitId,
                    quantity: item.quantity,
                    importPrice: Number(item.importPrice || 0),
                    sellPrice: 0,
                    vatPercent: 0,
                    warehouseId: item.warehouseId ?? undefined,
                    extraPrice: 0,
                })),
            );

            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    ...orderData,
                    ...(customerId !== undefined ? { customerId } : {}),
                    ...(deliveryId !== undefined ? { deliveryId } : {}),
                    profit,
                },
                include: this.orderInclude,
            });

            return {
                ...updatedOrder,
                profit: this.calculateOrderProfit({ ...updatedOrder, products: updatedOrder.products }),
            };
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
        const order = await this.prisma.order.findUnique({ where: { id }, select: { products: true } });
        if (!order) throw new NotFoundException('message.order.not-found');
        return this.prisma.$transaction(async (tx) => {
            await this.restoreStock(tx, order.products);
            await tx.orderProduct.deleteMany({ where: { orderId: id } });
            return tx.order.delete({ where: { id } });
        });
    }
}
