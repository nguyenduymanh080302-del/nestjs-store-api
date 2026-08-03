import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
    CreateProductBodyDto,
    GetProductsQueryDto,
    UpdateProductBodyDto,
} from 'common/dto/product.dto';
import { ImageService } from './image.service';
import { INSENSITIVE } from 'utils/constant';

type UploadedProductFile = {
    buffer: Buffer;
    mimetype?: string;
    originalname?: string;
};

@Injectable()
export class ProductService {
    /**
     * Constructs the ProductService instance.
     *
     * @param prisma Database service instance for Prisma ORM.
     * @param imageService Service for uploading and managing Cloudinary product images.
     */
    constructor(
        private readonly prisma: PrismaService,
        private readonly imageService: ImageService,
    ) { }

    private readonly productInclude = {
        images: true,
        units: {
            include: { unit: true },
        },
        category: true,
    };

    /**
     * Creates a new product along with associated uploaded images and product unit pricing information.
     *
     * @param dto DTO containing product properties (name, slug, categoryId, units list, base64 images, etc.).
     * @param imageFiles Array of multipart uploaded image files.
     * @returns Created product entity with images, category, and units.
     */
    async createProduct(
        dto: CreateProductBodyDto,
        imageFiles: UploadedProductFile[] = [],
    ) {
        const { images, units, ...productData } = dto;

        const uploadedUrls = await this.imageService.uploadImages(
            imageFiles,
            images,
        );

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: productData,
            });

            if (uploadedUrls.length) {
                await this.imageService.createProductImages(
                    product.id,
                    uploadedUrls,
                    tx,
                );
            }

            if (units?.length) {
                await tx.productUnit.createMany({
                    data: units.map((u) => ({
                        productId: product.id,
                        unitId: u.unitId,
                        importPrice: u.importPrice ?? 0,
                        sellPrice: u.sellPrice,
                        vatPercent: u.vatPercent,
                        extraPrices: u.extraPrices,
                    })),
                });
            }

            return tx.product.findUnique({
                where: { id: product.id },
                include: this.productInclude,
            });
        });
    }

    /**
     * Retrieves a paginated list of products with accent-insensitive search capabilities across name, slug, and description.
     *
     * @param query DTO containing page, limit, and optional search text.
     * @returns Object with array of product items and pagination details.
     */
    async findAllProduct(query: GetProductsQueryDto) {

        const trimmedSearch = query.search?.trim();
        const { page = 1, limit = 10, isActive = true } = query;
        const skip = (page - 1) * limit;

        if (!trimmedSearch) {
            const [items, total] = await this.prisma.$transaction([
                this.prisma.product.findMany({
                    include: this.productInclude,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    where: {
                        isActive: isActive,
                    },
                }),
                this.prisma.product.count(),
            ]);

            return {
                items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
                },
            };
        }

        const search = `%${trimmedSearch.toLowerCase()}%`;
        const accentFrom = INSENSITIVE.ACCENT_FROM
        const accentTo = INSENSITIVE.ACCENT_TO

        const [productIds, totalResult] = await this.prisma.$transaction([
            this.prisma.$queryRaw<{ id: number }[]>`
                SELECT p."id"
                FROM "Product" p
                WHERE translate(lower(p."name"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                   OR translate(lower(p."slug"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                   OR translate(lower(p."description"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                ORDER BY p."createdAt" DESC
                LIMIT ${limit}
                OFFSET ${skip}
            `,
            this.prisma.$queryRaw<{ count: number }[]>`
                SELECT count(*)::int AS count
                FROM "Product" p
                WHERE translate(lower(p."name"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                   OR translate(lower(p."slug"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                   OR translate(lower(p."description"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
            `,
        ]);

        const total = totalResult[0]?.count ?? 0;
        const ids = productIds.map((item) => item.id);

        const items = ids.length
            ? await this.prisma.product.findMany({
                where: { id: { in: ids } },
                include: this.productInclude,
                orderBy: { createdAt: 'desc' },
            })
            : [];

        const itemsById = new Map(items.map((item) => [item.id, item]));
        const orderedItems = ids.map((id) => itemsById.get(id)).filter(Boolean);

        return {
            items: orderedItems,
            pagination: {
                page,
                limit,
                total,
                totalPages: total === 0 ? 0 : Math.ceil(total / limit),
            },
        };
    }

    /**
     * Finds a single product by its ID, including images, category, and units.
     *
     * @param id The unique identifier of the product.
     * @returns The product entity if found.
     * @throws NotFoundException If no product exists with the specified ID.
     */
    async findProductById(id: number) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: this.productInclude,
        });

        if (!product) {
            throw new NotFoundException('message.product.not-found');
        }

        return product;
    }

    /**
     * Updates product details, image list (adding/deleting), and associated units.
     *
     * @param productId The ID of the product to update.
     * @param dto DTO containing updated product fields, image IDs to delete, base64 images, and unit configuration.
     * @param imageFiles Array of newly uploaded image files.
     * @returns Updated product entity with full relation inclusions.
     * @throws BadRequestException If attempting to remove a unit that is referenced in orders, imports, or warehouse stock.
     */
    async updateProduct(
        productId: number,
        dto: UpdateProductBodyDto,
        imageFiles: UploadedProductFile[] = [],
    ) {
        const { images, deleteImageIds, units, ...productData } = dto;

        return this.prisma.$transaction(async (tx) => {
            await tx.product.update({
                where: { id: productId },
                data: productData,
            });

            if (deleteImageIds?.length) {
                await this.imageService.deleteImagesByIds(deleteImageIds);
            }

            const uploadedUrls = await this.imageService.uploadImages(
                imageFiles,
                images,
            );

            if (uploadedUrls.length) {
                await this.imageService.createProductImages(
                    productId,
                    uploadedUrls,
                    tx,
                );
            }

            if (units?.length) {
                const unitIds = units.map((u) => u.unitId);

                const existingUnits = await tx.productUnit.findMany({
                    where: { productId },
                    select: { unitId: true },
                });

                const deleteUnitIds = existingUnits
                    .filter((item) => !unitIds.includes(item.unitId))
                    .map((item) => item.unitId);

                if (deleteUnitIds.length) {
                    const [orderReferences, importReferences, warehouseReferences] =
                        await Promise.all([
                            tx.orderProduct.count({
                                where: {
                                    productId,
                                    unitId: { in: deleteUnitIds },
                                },
                            }),
                            tx.importItem.count({
                                where: {
                                    productId,
                                    unitId: { in: deleteUnitIds },
                                },
                            }),
                            tx.warehouseProduct.count({
                                where: {
                                    productId,
                                    unitId: { in: deleteUnitIds },
                                },
                            }),
                        ]);

                    if (orderReferences + importReferences + warehouseReferences > 0) {
                        throw new BadRequestException(
                            'message.product.unit-cannot-be-removed',
                        );
                    }

                    await tx.productUnit.deleteMany({
                        where: {
                            productId,
                            unitId: { in: deleteUnitIds },
                        },
                    });
                }

                const existingUnitIds = new Set(existingUnits.map((item) => item.unitId));
                const createManyData: Prisma.ProductUnitCreateManyInput[] = [];
                const updatePromises: Array<Promise<unknown>> = [];

                for (const unit of units) {
                    if (existingUnitIds.has(unit.unitId)) {
                        updatePromises.push(
                            tx.productUnit.update({
                                where: {
                                    productId_unitId: {
                                        productId,
                                        unitId: unit.unitId,
                                    },
                                },
                                data: {
                                    importPrice: unit.importPrice ?? 0,
                                    sellPrice: unit.sellPrice,
                                    vatPercent: unit.vatPercent,
                                    extraPrices: unit.extraPrices,
                                },
                            }),
                        );
                    } else {
                        createManyData.push({
                            productId,
                            unitId: unit.unitId,
                            importPrice: unit.importPrice ?? 0,
                            sellPrice: unit.sellPrice,
                            vatPercent: unit.vatPercent,
                            extraPrices: unit.extraPrices,
                        });
                    }
                }

                if (createManyData.length) {
                    await tx.productUnit.createMany({ data: createManyData });
                }

                if (updatePromises.length) {
                    await Promise.all(updatePromises);
                }
            }

            return tx.product.findUnique({
                where: { id: productId },
                include: this.productInclude,
            });
        });
    }

    /**
     * Deletes a product by ID and cleans up hosted images from Cloudinary.
     *
     * @param id The unique identifier of the product to delete.
     * @returns The deleted product entity.
     * @throws NotFoundException If the product is not found.
     */
    async removeProduct(id: number) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: { images: true },
        });

        if (!product) {
            throw new NotFoundException('message.product.not-found');
        }

        await this.imageService.deleteImagesByUrls(
            product.images.map((img) => img.url),
        );

        return this.prisma.product.delete({
            where: { id },
        });
    }
}
