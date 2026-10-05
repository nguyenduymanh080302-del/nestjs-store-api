import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { ApiResponse } from 'src/types';
import {
  CreateCategoryBodyDto,
  DeleteCategoryParamDto,
  GetCategoryParamDto,
  UpdateCategoryBodyDto,
  UpdateCategoryParamDto
} from 'common/dto/category.dto';
import { CategoryEntity } from 'common/entities/category.entity';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';

@Controller('category')
export class CategoryController {
  /**
   * Constructs the CategoryController instance.
   *
   * @param categoryService Service handling product category business logic.
   */
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * Endpoint to create a new category.
   *
   * @param data DTO payload containing category creation attributes.
   * @returns ApiResponse containing created category entity.
   */
  @UseGuards(JwtAccessGuard)
  @Post()
  async createCategory(
    @Body() data: CreateCategoryBodyDto
  ): Promise<ApiResponse<CategoryEntity>> {
    const result = await this.categoryService.createCategory(data);

    return {
      status: HttpStatus.CREATED,
      message: 'message.category.created',
      data: result
    };
  }

  /**
   * Endpoint to retrieve all categories sorted by slug.
   *
   * @returns ApiResponse containing list of category entities.
   */
  @Get()
  async findAllCategory(): Promise<ApiResponse<CategoryEntity[]>> {
    const result = await this.categoryService.findAllCategory();

    return {
      status: HttpStatus.OK,
      message: 'message.category.success',
      data: result
    };
  }

  /**
   * Endpoint to retrieve a single category by ID.
   *
   * @param params DTO containing category ID path parameter.
   * @returns ApiResponse containing category entity.
   */
  @Get(':id')
  async findCategoryById(
    @Param() params: GetCategoryParamDto
  ): Promise<ApiResponse<CategoryEntity>> {
    const result = await this.categoryService.findCategoryById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.category.success',
      data: result
    };
  }

  /**
   * Endpoint to update an existing category by ID.
   *
   * @param params DTO containing category ID path parameter.
   * @param data DTO payload containing updated category fields.
   * @returns ApiResponse containing updated category entity.
   * @throws BadRequestException If neither name nor slug is provided in update payload.
   */
  @UseGuards(JwtAccessGuard)
  @Patch(':id')
  async updateCategory(
    @Param() params: UpdateCategoryParamDto,
    @Body() data: UpdateCategoryBodyDto
  ): Promise<ApiResponse<CategoryEntity>> {
    if (!data.name && !data.slug) {
      throw new BadRequestException('message.category.missing-data');
    }

    const result = await this.categoryService.updateCategory(params.id, data);

    return {
      status: HttpStatus.OK,
      message: 'message.category.updated',
      data: result
    };
  }

  /**
   * Endpoint to delete a category by ID.
   *
   * @param params DTO containing category ID path parameter.
   * @returns ApiResponse indicating category deletion success.
   */
  @Delete(':id')
  async removeCategory(
    @Param() params: DeleteCategoryParamDto
  ): Promise<ApiResponse<null>> {
    await this.categoryService.removeCategory(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.category.deleted'
    };
  }
}
