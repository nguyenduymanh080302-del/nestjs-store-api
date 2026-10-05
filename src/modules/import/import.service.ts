import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { CreateImportBodyDto } from 'common/dto/import.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ImportService {
  /**
   * Constructs the ImportService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new stock import transaction, updates warehouse product inventory, and creates import records.
   *
   * @param dto DTO containing import details including warehouseId, supplierId, and array of imported products with quantities.
   * @returns The created import record with its items.
   * @throws BadRequestException If duplicate product-unit combinations are passed in the import payload.
   * @throws NotFoundException If the specified warehouse, supplier, or product-unit combination is not found.
   */
  async createImport(dto: CreateImportBodyDto) {
    const keys = new Set<string>();
    for (const item of dto.products) {
      const key = `${item.productId}-${item.unitId}`;
      if (keys.has(key))
        throw new BadRequestException('message.import.product-duplicated');
      keys.add(key);
    }

    const [warehouse, supplier, productUnits] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.productUnit.findMany({
        where: {
          OR: dto.products.map(({ productId, unitId }) => ({
            productId,
            unitId
          }))
        },
        select: { productId: true, unitId: true }
      })
    ]);

    if (!warehouse)
      throw new NotFoundException('message.import.warehouse-not-found');
    if (!supplier)
      throw new NotFoundException('message.import.supplier-not-found');
    if (productUnits.length !== dto.products.length)
      throw new NotFoundException('message.import.product-not-found');

    return this.prisma.$transaction(async (tx) => {
      const importRecord = await tx.import.create({
        data: {
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId,
          totalAmount: 0,
          status: 'DONE',
          importItems: {
            create: dto.products.map((item) => ({
              productId: item.productId,
              unitId: item.unitId,
              quantity: item.quantity
            }))
          }
        },
        include: { importItems: true }
      });

      for (const item of dto.products) {
        await tx.warehouseProduct.upsert({
          where: {
            warehouseId_productId_unitId: {
              warehouseId: dto.warehouseId,
              productId: item.productId,
              unitId: item.unitId
            }
          },
          create: {
            warehouseId: dto.warehouseId,
            productId: item.productId,
            unitId: item.unitId,
            quantity: item.quantity
          },
          update: { quantity: { increment: item.quantity } }
        });
      }

      return importRecord;
    });
  }
}
