import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { CreateUnitBodyDto, UpdateUnitBodyDto } from 'common/dto/unit.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UnitService {
  /**
   * Constructs the UnitService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new measurement unit after checking name uniqueness.
   *
   * @param data DTO containing unit creation properties (name, description, etc.).
   * @returns The created unit entity.
   * @throws ConflictException If a unit with the same name already exists.
   */
  async createUnit(data: CreateUnitBodyDto) {
    const exists = await this.prisma.unit.findUnique({
      where: { name: data.name }
    });

    if (exists) {
      throw new ConflictException('message.unit.name-duplicated');
    }

    const newUnit = await this.prisma.unit.create({ data });
    return newUnit;
  }

  /**
   * Retrieves all measurement units sorted by name in descending order.
   *
   * @returns List of all unit entities.
   */
  async findAllUnit() {
    return await this.prisma.unit.findMany({
      orderBy: { name: 'desc' }
    });
  }

  /**
   * Finds a measurement unit by its unique ID.
   *
   * @param id The unique identifier of the unit.
   * @returns The unit entity if found.
   * @throws NotFoundException If no unit is found with the given ID.
   */
  async findUnitById(id: number) {
    const unit = await this.prisma.unit.findUnique({
      where: { id }
    });

    if (!unit) {
      throw new NotFoundException('message.unit.not-found');
    }

    return unit;
  }

  /**
   * Updates an existing measurement unit by ID.
   *
   * @param id The unique identifier of the unit to update.
   * @param data DTO containing fields to update in the unit.
   * @returns The updated unit entity.
   * @throws NotFoundException If the unit is not found.
   */
  async updateUnit(id: number, data: UpdateUnitBodyDto) {
    await this.findUnitById(id);

    return this.prisma.unit.update({
      where: { id },
      data
    });
  }

  /**
   * Removes a measurement unit by ID.
   *
   * @param id The unique identifier of the unit to delete.
   * @returns The deleted unit entity.
   * @throws NotFoundException If the unit is not found.
   */
  async removeUnit(id: number) {
    await this.findUnitById(id);

    return this.prisma.unit.delete({
      where: { id }
    });
  }
}
