import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  CreateCustomerBodyDto,
  UpdateCustomerBodyDto
} from 'common/dto/customer.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CustomerService {
  /**
   * Constructs the CustomerService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new customer record after checking phone number uniqueness.
   *
   * @param data DTO containing customer details (name, phone, address, etc.).
   * @returns The newly created customer entity.
   * @throws ConflictException If a customer with the given phone number already exists.
   */
  async createCustomer(data: CreateCustomerBodyDto) {
    if (data.phone) {
      const exists = await this.prisma.customer.findUnique({
        where: { phone: data.phone }
      });

      if (exists) {
        throw new ConflictException('message.customer.phone-duplicated');
      }
    }

    return this.prisma.customer.create({
      data
    });
  }

  /**
   * Retrieves all customers sorted by name in descending order.
   *
   * @returns List of all customer records.
   */
  async findAllCustomer() {
    return this.prisma.customer.findMany({
      orderBy: { name: 'desc' }
    });
  }

  /**
   * Finds a customer by their unique ID.
   *
   * @param id The unique identifier of the customer.
   * @returns The customer entity if found.
   * @throws NotFoundException If no customer is found with the specified ID.
   */
  async findCustomerById(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      throw new NotFoundException('message.customer.not-found');
    }

    return customer;
  }

  /**
   * Updates an existing customer's details and verifies phone uniqueness.
   *
   * @param id The unique identifier of the customer to update.
   * @param data DTO containing updated customer attributes.
   * @returns The updated customer entity.
   * @throws NotFoundException If the customer is not found.
   * @throws ConflictException If the updated phone number is already used by another customer.
   */
  async updateCustomer(id: number, data: UpdateCustomerBodyDto) {
    await this.findCustomerById(id);

    // Check phone duplication if phone is updated
    if (data.phone) {
      const exists = await this.prisma.customer.findUnique({
        where: { phone: data.phone }
      });

      if (exists && exists.id !== id) {
        throw new ConflictException('message.customer.phone-duplicated');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data
    });
  }

  /**
   * Deletes a customer record by ID.
   *
   * @param id The unique identifier of the customer to delete.
   * @returns The deleted customer entity.
   * @throws NotFoundException If the customer is not found.
   */
  async removeCustomer(id: number) {
    await this.findCustomerById(id);

    return this.prisma.customer.delete({
      where: { id }
    });
  }
}
