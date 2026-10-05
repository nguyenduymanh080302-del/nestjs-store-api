import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  CreateSupplierBodyDto,
  UpdateSupplierBodyDto
} from 'common/dto/supplier.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SupplierService {
  /**
   * Constructs the SupplierService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new supplier entity after checking phone duplication.
   *
   * @param data DTO containing supplier creation properties (name, phone, address, etc.).
   * @returns The created supplier entity.
   * @throws ConflictException If a supplier with the given phone number already exists.
   */
  async createSupplier(data: CreateSupplierBodyDto) {
    if (data.phone) {
      const exists = await this.prisma.supplier.findUnique({
        where: { phone: data.phone }
      });

      if (exists) {
        throw new ConflictException('message.supplier.phone-duplicated');
      }
    }
    const newSupplier = await this.prisma.supplier.create({
      data
    });

    return newSupplier;
  }

  /**
   * Retrieves all suppliers sorted by name in descending order.
   *
   * @returns List of all supplier entities.
   */
  async findAllSupplier() {
    return await this.prisma.supplier.findMany({
      orderBy: { name: 'desc' }
    });
  }

  /**
   * Finds a supplier by its unique ID.
   *
   * @param id The unique identifier of the supplier.
   * @returns The supplier entity if found.
   * @throws NotFoundException If no supplier exists with the specified ID.
   */
  async findSupplierById(id: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id }
    });
    if (!supplier) {
      throw new NotFoundException('message.supplier.not-found');
    }
    return supplier;
  }

  /**
   * Updates an existing supplier record and checks for phone number duplication.
   *
   * @param id The unique identifier of the supplier to update.
   * @param data DTO containing fields to update in the supplier entity.
   * @returns The updated supplier entity.
   * @throws NotFoundException If the supplier is not found.
   * @throws ConflictException If the updated phone number belongs to another existing supplier.
   */
  async updateSupplier(id: number, data: UpdateSupplierBodyDto) {
    await this.findSupplierById(id);

    if (data.phone) {
      const exists = await this.prisma.supplier.findUnique({
        where: { phone: data.phone }
      });

      if (exists && exists.id !== id) {
        throw new ConflictException('message.supplier.phone-duplicated');
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data
    });
  }

  /**
   * Deletes a supplier by ID.
   *
   * @param id The unique identifier of the supplier to remove.
   * @returns The deleted supplier entity.
   * @throws NotFoundException If the supplier is not found.
   */
  async removeSupplier(id: number) {
    await this.findSupplierById(id);

    return this.prisma.supplier.delete({
      where: { id }
    });
  }
}
