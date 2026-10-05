import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  CreateDeliveryBodyDto,
  UpdateDeliveryBodyDto
} from 'common/dto/delivery.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DeliveryService {
  /**
   * Constructs the DeliveryService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new delivery partner/unit record after verifying phone uniqueness.
   *
   * @param data DTO containing delivery entity details (name, phone, address, etc.).
   * @returns The created delivery entity.
   * @throws ConflictException If a delivery partner with the given phone number already exists.
   */
  async createDelivery(data: CreateDeliveryBodyDto) {
    if (data.phone) {
      const exists = await this.prisma.delivery.findUnique({
        where: { phone: data.phone }
      });

      if (exists) {
        throw new ConflictException('message.delivery.phone-duplicated');
      }
    }

    return this.prisma.delivery.create({
      data
    });
  }

  /**
   * Retrieves all delivery entities sorted by name in descending order.
   *
   * @returns List of all delivery records.
   */
  async findAllDelivery() {
    return this.prisma.delivery.findMany({
      orderBy: { name: 'desc' }
    });
  }

  /**
   * Finds a delivery partner by ID.
   *
   * @param id The unique identifier of the delivery entity.
   * @returns The delivery record if found.
   * @throws NotFoundException If no delivery record is found with the given ID.
   */
  async findDeliveryById(id: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id }
    });

    if (!delivery) {
      throw new NotFoundException('message.delivery.not-found');
    }

    return delivery;
  }

  /**
   * Updates an existing delivery record and checks for phone duplication.
   *
   * @param id The unique identifier of the delivery partner to update.
   * @param data DTO containing fields to update.
   * @returns The updated delivery entity.
   * @throws NotFoundException If the delivery partner is not found.
   * @throws ConflictException If the updated phone number is already registered to another delivery partner.
   */
  async updateDelivery(id: number, data: UpdateDeliveryBodyDto) {
    await this.findDeliveryById(id);

    // Check phone duplication if phone is being updated
    if (data.phone) {
      const exists = await this.prisma.delivery.findUnique({
        where: { phone: data.phone }
      });

      if (exists && exists.id !== id) {
        throw new ConflictException('message.delivery.phone-duplicated');
      }
    }

    return this.prisma.delivery.update({
      where: { id },
      data
    });
  }

  /**
   * Removes a delivery partner by ID.
   *
   * @param id The unique identifier of the delivery partner to delete.
   * @returns The deleted delivery entity.
   * @throws NotFoundException If the delivery partner is not found.
   */
  async removeDelivery(id: number) {
    await this.findDeliveryById(id);

    return this.prisma.delivery.delete({
      where: { id }
    });
  }
}
