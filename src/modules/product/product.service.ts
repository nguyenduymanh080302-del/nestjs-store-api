import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateProductBodyDto,
  ImportProductItemDto,
  ImportProductsBodyDto,
  GetProductsQueryDto,
  UpdateProductBodyDto
} from 'common/dto/product.dto';
import {
  ImageService,
  type UploadedImageFile
} from 'modules/image/image.service';
import { INSENSITIVE } from 'utils/constant';

@Injectable()
export class ProductService {
  /**
   * Constructs the ProductService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   * @param imageService Service for uploading and managing Cloudflare R2 product images.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService
  ) {}

  private readonly productInclude = {
    images: true,
    units: {
      include: {
        unit: true,
        warehouseProducts: {
          where: { warehouse: { isActive: true } },
          select: { warehouseId: true, quantity: true }
        }
      }
    },
    category: true
  };

  private normalizeImportedUrls(images?: string[]) {
    return (images || []).map((url) => url?.trim()).filter(Boolean);
  }

  /**
   * Creates a new product along with associated uploaded images and product unit pricing information.
   *
   * @param dto DTO containing product properties (name, slug, categoryId, units list, base64 images, etc.).
   * @param imageFiles Array of multipart uploaded image files.
   * @returns Created product entity with images, category, and units.
   */
  async createProduct(
    dto: CreateProductBodyDto,
    imageFiles: UploadedImageFile[] = []
  ) {
    const { images, units, ...productData } = dto;

    const uploadedUrls = await this.imageService.uploadImages(
      imageFiles,
      images
    );

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: productData
      });

      if (uploadedUrls.length) {
        await tx.image.createMany({
          data: uploadedUrls.map((url) => ({
            productId: product.id,
            url
          }))
        });
      }

      if (units?.length) {
        await tx.productUnit.createMany({
          data: units.map((u) => ({
            productId: product.id,
            unitId: u.unitId,
            importPrice: u.importPrice ?? 0,
            sellPrice: u.sellPrice,
            vatPercent: u.vatPercent
          }))
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: this.productInclude
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
    const categorySlug = query.categorySlug?.trim();
    const selectedCategory =
      categorySlug && categorySlug !== 'all' ? categorySlug : undefined;
    const { page = 1, limit = 10, isActive } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(isActive === undefined ? {} : { isActive }),
      ...(selectedCategory || isActive === true
        ? {
            category: {
              ...(selectedCategory ? { slug: selectedCategory } : {}),
              ...(isActive === true ? { isActive: true } : {})
            }
          }
        : {})
    };

    if (!trimmedSearch) {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({
          include: this.productInclude,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          where
        }),
        this.prisma.product.count({ where })
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

    const search = `%${trimmedSearch.toLowerCase()}%`;
    const accentFrom = INSENSITIVE.ACCENT_FROM;
    const accentTo = INSENSITIVE.ACCENT_TO;

    const [productIds, totalResult] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ id: number }[]>`
                SELECT p."id"
                FROM "Product" p
                INNER JOIN "Category" c ON c."id" = p."categoryId"
                WHERE (${isActive === undefined} OR p."isActive" = ${isActive ?? true})
                  AND (${isActive !== true} OR c."isActive" = true)
                  AND (${selectedCategory === undefined} OR c."slug" = ${selectedCategory ?? ''})
                  AND (
                    translate(lower(p."name"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                    OR translate(lower(p."slug"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                    OR translate(lower(p."description"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                  )
                ORDER BY p."createdAt" DESC
                LIMIT ${limit}
                OFFSET ${skip}
            `,
      this.prisma.$queryRaw<{ count: number }[]>`
                SELECT count(*)::int AS count
                FROM "Product" p
                INNER JOIN "Category" c ON c."id" = p."categoryId"
                WHERE (${isActive === undefined} OR p."isActive" = ${isActive ?? true})
                  AND (${isActive !== true} OR c."isActive" = true)
                  AND (${selectedCategory === undefined} OR c."slug" = ${selectedCategory ?? ''})
                  AND (
                    translate(lower(p."name"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                    OR translate(lower(p."slug"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                    OR translate(lower(p."description"), ${accentFrom}, ${accentTo}) LIKE translate(lower(${search}), ${accentFrom}, ${accentTo})
                  )
            `
    ]);

    const total = totalResult[0]?.count ?? 0;
    const ids = productIds.map((item) => item.id);

    const items = ids.length
      ? await this.prisma.product.findMany({
          where: { id: { in: ids } },
          include: this.productInclude,
          orderBy: { createdAt: 'desc' }
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
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      }
    };
  }

  /**
   * Retrieves all products for spreadsheet export, including inactive items.
   *
   * @returns Full list of product records with related category and images.
   */
  async findAllProductForExport() {
    return this.prisma.product.findMany({
      include: this.productInclude,
      orderBy: { createdAt: 'desc' }
    });
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
      include: this.productInclude
    });

    if (!product) {
      throw new NotFoundException('message.product.not-found');
    }

    return product;
  }

  /** Retrieves an active storefront product by its slug. */
  async findActiveProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true, category: { isActive: true } },
      include: this.productInclude
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
    imageFiles: UploadedImageFile[] = []
  ) {
    const { images, deleteImageIds, units, ...productData } = dto;

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: productData
      });

      if (deleteImageIds?.length) {
        const deletedImages = await tx.image.findMany({
          where: {
            id: { in: deleteImageIds },
            productId
          }
        });

        await this.imageService.deleteImages(
          deletedImages.map((image) => image.url)
        );

        await tx.image.deleteMany({
          where: {
            id: { in: deleteImageIds },
            productId
          }
        });
      }

      const uploadedUrls = await this.imageService.uploadImages(
        imageFiles,
        images
      );

      if (uploadedUrls.length) {
        await tx.image.createMany({
          data: uploadedUrls.map((url) => ({
            productId,
            url
          }))
        });
      }

      if (units?.length) {
        const unitIds = units.map((u) => u.unitId);

        const existingUnits = await tx.productUnit.findMany({
          where: { productId },
          select: { unitId: true }
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
                  unitId: { in: deleteUnitIds }
                }
              }),
              tx.importItem.count({
                where: {
                  productId,
                  unitId: { in: deleteUnitIds }
                }
              }),
              tx.warehouseProduct.count({
                where: {
                  productId,
                  unitId: { in: deleteUnitIds }
                }
              })
            ]);

          if (orderReferences + importReferences + warehouseReferences > 0) {
            throw new BadRequestException(
              'message.product.unit-cannot-be-removed'
            );
          }

          await tx.productUnit.deleteMany({
            where: {
              productId,
              unitId: { in: deleteUnitIds }
            }
          });
        }

        const existingUnitIds = new Set(
          existingUnits.map((item) => item.unitId)
        );
        const createManyData: Prisma.ProductUnitCreateManyInput[] = [];
        const updatePromises: Array<Promise<unknown>> = [];

        for (const unit of units) {
          if (existingUnitIds.has(unit.unitId)) {
            updatePromises.push(
              tx.productUnit.update({
                where: {
                  productId_unitId: {
                    productId,
                    unitId: unit.unitId
                  }
                },
                data: {
                  importPrice: unit.importPrice ?? 0,
                  sellPrice: unit.sellPrice,
                  vatPercent: unit.vatPercent
                }
              })
            );
          } else {
            createManyData.push({
              productId,
              unitId: unit.unitId,
              importPrice: unit.importPrice ?? 0,
              sellPrice: unit.sellPrice,
              vatPercent: unit.vatPercent
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
        include: this.productInclude
      });
    });
  }

  /**
   * Imports spreadsheet product rows by upserting records using slug as the unique key.
   *
   * @param dto Imported product payload containing the rows from the product sheet.
   * @returns Summary of created and updated products.
   */
  async importProducts(dto: ImportProductsBodyDto) {
    const rows = dto.products;
    const seenSlugs = new Set<string>();

    for (const row of rows) {
      const slug = row.slug.trim();
      if (seenSlugs.has(slug)) {
        throw new ConflictException('message.product.slug-duplicated');
      }
      seenSlugs.add(slug);
    }

    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true }
    });

    if (categories.length !== categoryIds.length) {
      throw new NotFoundException('message.category.not-found');
    }

    const existingProducts = await this.prisma.product.findMany({
      where: { slug: { in: rows.map((row) => row.slug.trim()) } },
      include: { images: true }
    });

    const existingProductMap = new Map(
      existingProducts.map((product) => [product.slug, product])
    );
    const deletedImageUrls: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    const importedProducts = await this.prisma.$transaction(async (tx) => {
      const result: Array<Awaited<ReturnType<typeof tx.product.findUnique>>> =
        [];

      for (const rawRow of rows) {
        const row: ImportProductItemDto = {
          ...rawRow,
          slug: rawRow.slug.trim(),
          name: rawRow.name.trim(),
          description: rawRow.description.trim(),
          images: this.normalizeImportedUrls(rawRow.images)
        };

        const existingProduct = existingProductMap.get(row.slug);
        const imageUrls = row.images || [];

        if (existingProduct) {
          updatedCount += 1;
          if (existingProduct.images.length) {
            deletedImageUrls.push(
              ...existingProduct.images.map((image) => image.url)
            );
          }

          await tx.product.update({
            where: { id: existingProduct.id },
            data: {
              name: row.name,
              slug: row.slug,
              description: row.description,
              categoryId: row.categoryId,
              isActive: row.isActive ?? true
            }
          });

          await tx.image.deleteMany({
            where: { productId: existingProduct.id }
          });

          if (imageUrls.length) {
            await tx.image.createMany({
              data: imageUrls.map((url) => ({
                productId: existingProduct.id,
                url
              }))
            });
          }

          const updatedProduct = await tx.product.findUnique({
            where: { id: existingProduct.id },
            include: this.productInclude
          });

          if (updatedProduct) {
            result.push(updatedProduct);
          }
          continue;
        }

        createdCount += 1;
        const product = await tx.product.create({
          data: {
            name: row.name,
            slug: row.slug,
            description: row.description,
            categoryId: row.categoryId,
            isActive: row.isActive ?? true
          }
        });

        if (imageUrls.length) {
          await tx.image.createMany({
            data: imageUrls.map((url) => ({
              productId: product.id,
              url
            }))
          });
        }

        const createdProduct = await tx.product.findUnique({
          where: { id: product.id },
          include: this.productInclude
        });

        if (createdProduct) {
          result.push(createdProduct);
        }
      }

      return result;
    });

    if (deletedImageUrls.length) {
      await this.imageService.deleteImages(deletedImageUrls);
    }

    return {
      createdCount,
      updatedCount,
      total: importedProducts.length,
      items: importedProducts
    };
  }

  /**
   * Deletes a product by ID and cleans up hosted images from Cloudflare R2.
   *
   * @param id The unique identifier of the product to delete.
   * @returns The deleted product entity.
   * @throws NotFoundException If the product is not found.
   */
  async removeProduct(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true }
    });

    if (!product) {
      throw new NotFoundException('message.product.not-found');
    }

    await this.imageService.deleteImages(product.images.map((img) => img.url));

    return this.prisma.product.delete({
      where: { id }
    });
  }
}
