import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  CreateWarehouseBodyDto,
  UpdateWarehouseBodyDto
} from 'common/dto/warehouse.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WarehouseService {
  /**
   * Constructs the WarehouseService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new warehouse after verifying name uniqueness.
   *
   * @param data DTO containing warehouse creation properties (name, address, etc.).
   * @returns The created warehouse entity.
   * @throws ConflictException If a warehouse with the specified name already exists.
   */
  async createWarehouse(data: CreateWarehouseBodyDto) {
    const exists = await this.prisma.warehouse.findUnique({
      where: { name: data.name }
    });

    if (exists) {
      throw new ConflictException('message.warehouse.name-duplicated');
    }

    return this.prisma.warehouse.create({ data });
  }

  /**
   * Retrieves all warehouses sorted by name in ascending order, including stored products and quantities.
   *
   * @returns Array of warehouse entities with product inventory summary.
   */
  async findAllWarehouse() {
    return this.prisma.warehouse.findMany({
      include: {
        products: {
          select: {
            productId: true,
            unitId: true,
            quantity: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Finds a warehouse by its unique ID.
   *
   * @param id The unique identifier of the warehouse.
   * @returns The warehouse entity if found.
   * @throws NotFoundException If no warehouse exists with the specified ID.
   */
  async findWarehouseById(id: number) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });

    if (!warehouse) {
      throw new NotFoundException('message.warehouse.not-found');
    }

    return warehouse;
  }

  /**
   * Updates an existing warehouse record by ID and checks for name duplication.
   *
   * @param id The unique identifier of the warehouse to update.
   * @param data DTO containing fields to update in the warehouse entity.
   * @returns The updated warehouse entity.
   * @throws NotFoundException If the warehouse is not found.
   * @throws ConflictException If the updated warehouse name is already taken by another warehouse.
   */
  async updateWarehouse(id: number, data: UpdateWarehouseBodyDto) {
    await this.findWarehouseById(id);

    if (data.name) {
      const exists = await this.prisma.warehouse.findUnique({
        where: { name: data.name }
      });

      if (exists && exists.id !== id) {
        throw new ConflictException('message.warehouse.name-duplicated');
      }
    }

    return this.prisma.warehouse.update({
      where: { id },
      data
    });
  }

  /**
   * Removes a warehouse by ID.
   *
   * @param id The unique identifier of the warehouse to delete.
   * @returns The deleted warehouse entity.
   * @throws NotFoundException If the warehouse is not found.
   */
  async removeWarehouse(id: number) {
    await this.findWarehouseById(id);

    return this.prisma.warehouse.delete({ where: { id } });
  }
}
