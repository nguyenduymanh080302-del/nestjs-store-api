import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  CreateCategoryBodyDto,
  UpdateCategoryBodyDto
} from 'common/dto/category.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CategoryService {
  /**
   * Constructs the CategoryService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new product category after checking slug uniqueness.
   *
   * @param data DTO containing category attributes (name, slug, description, etc.).
   * @returns The created category entity.
   * @throws ConflictException If a category with the same slug already exists.
   */
  async createCategory(data: CreateCategoryBodyDto) {
    const exists = await this.prisma.category.findUnique({
      where: { slug: data.slug }
    });

    if (exists) {
      throw new ConflictException('message.category.slug-duplicated');
    }

    const newCategory = await this.prisma.category.create({ data });
    return newCategory;
  }

  /**
   * Retrieves all categories sorted by slug in ascending order.
   *
   * @returns A list of all category entities.
   */
  async findAllCategory() {
    return await this.prisma.category.findMany({
      orderBy: { slug: 'asc' }
    });
  }

  /**
   * Finds a category by its unique ID.
   *
   * @param id The unique identifier of the category.
   * @returns The category entity if found.
   * @throws NotFoundException If no category exists with the provided ID.
   */
  async findCategoryById(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id }
    });

    if (!category) {
      throw new NotFoundException('message.category.not-found');
    }

    return category;
  }

  /**
   * Updates an existing category by its ID.
   *
   * @param id The unique identifier of the category to update.
   * @param data DTO containing the fields to update.
   * @returns The updated category entity.
   * @throws NotFoundException If the category to update is not found.
   */
  async updateCategory(id: number, data: UpdateCategoryBodyDto) {
    await this.findCategoryById(id);

    return this.prisma.category.update({
      where: { id },
      data
    });
  }

  /**
   * Removes a category by its ID.
   *
   * @param id The unique identifier of the category to delete.
   * @returns The deleted category entity.
   * @throws NotFoundException If the category to remove is not found.
   */
  async removeCategory(id: number) {
    await this.findCategoryById(id);

    return this.prisma.category.delete({
      where: { id }
    });
  }
}
