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
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateProductBodyDto,
  DeleteProductParamDto,
  ImportProductsBodyDto,
  GetProductParamDto,
  GetProductSlugParamDto,
  GetProductsQueryDto,
  UpdateProductBodyDto,
  UpdateProductParamDto
} from 'common/dto/product.dto';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { UploadedImageFile } from 'modules/image/image.service';
import { ApiResponse } from 'src/types';
import { ProductService } from './product.service';

@Controller('product')
export class ProductController {
  /**
   * Constructs the ProductController instance.
   *
   * @param productService Service handling product management, image uploads, and unit pricing.
   */
  constructor(private readonly productService: ProductService) {}

  /**
   * Normalizes multipart form field data, converting stringified JSON arrays and numbers into native JS types.
   *
   * @param data Raw key-value object parsed from request body.
   * @returns Normalized data object.
   */
  private parseJson(value: string): unknown {
    return JSON.parse(value) as unknown;
  }

  private normalizeProductBody(data: Record<string, unknown>) {
    const normalized = { ...data };

    if (typeof normalized.categoryId === 'string') {
      normalized.categoryId = Number(normalized.categoryId);
    }

    if (typeof normalized.isActive === 'string') {
      normalized.isActive = normalized.isActive === 'true';
    }

    if (typeof normalized.units === 'string') {
      normalized.units = this.parseJson(normalized.units);
    }

    if (typeof normalized.deleteImageIds === 'string') {
      normalized.deleteImageIds = this.parseJson(normalized.deleteImageIds);
    }

    if (
      typeof normalized.images === 'string' &&
      normalized.images.trim().startsWith('[')
    ) {
      normalized.images = this.parseJson(normalized.images);
    }

    return normalized;
  }

  /**
   * Normalizes raw form body data and validates it against a target DTO class.
   *
   * @param dtoClass Target class constructor for DTO validation.
   * @param data Raw key-value object parsed from request body.
   * @returns Validated DTO instance.
   * @throws BadRequestException If parsing fails or validation constraints are violated.
   */
  private validatePayload<T extends object>(
    dtoClass: new () => T,
    data: Record<string, unknown>
  ): T {
    let normalized: Record<string, unknown>;

    try {
      normalized = this.normalizeProductBody(data);
    } catch {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message: 'message.validation-failed'
      });
    }

    const dto = plainToInstance(dtoClass, normalized);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true
    });

    if (errors.length) {
      const firstError = errors[0];
      const firstMessage =
        firstError &&
        firstError.constraints &&
        Object.values(firstError.constraints)[0];

      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message: firstMessage ?? 'message.validation-failed'
      });
    }

    return dto;
  }

  /**
   * Endpoint to create a new product along with uploaded image files.
   *
   * @param rawData Raw request body object containing product fields.
   * @param imageFiles Array of uploaded multipart image files.
   * @returns ApiResponse containing created product entity.
   */
  @UseGuards(JwtAccessGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async createProduct(
    @Body() rawData: Record<string, unknown>,
    @UploadedFiles() imageFiles: UploadedImageFile[] = []
  ): Promise<ApiResponse<any>> {
    const data = this.validatePayload(CreateProductBodyDto, rawData);
    const result = await this.productService.createProduct(data, imageFiles);

    return {
      status: HttpStatus.CREATED,
      message: 'message.product.created',
      data: result
    };
  }

  /**
   * Endpoint to query and retrieve a paginated list of products with accent-insensitive search.
   *
   * @param query DTO containing page, limit, and optional search term.
   * @returns ApiResponse containing paginated product list.
   */
  @Get()
  async findAllProduct(
    @Query() query: GetProductsQueryDto
  ): Promise<ApiResponse<any>> {
    const result = await this.productService.findAllProduct(query);

    return {
      status: HttpStatus.OK,
      message: 'message.product.success',
      data: result
    };
  }

  /**
   * Endpoint to export all products for spreadsheet download.
   *
   * @returns ApiResponse containing every product with category and image data.
   */
  @UseGuards(JwtAccessGuard)
  @Get('export')
  async exportProducts(): Promise<ApiResponse<any>> {
    const result = await this.productService.findAllProductForExport();

    return {
      status: HttpStatus.OK,
      message: 'message.product.success',
      data: result
    };
  }

  /**
   * Endpoint to find a product by ID.
   *
   * @param params DTO containing product ID path parameter.
   * @returns ApiResponse containing product details.
   */
  @Get(':id')
  async findProductById(
    @Param() params: GetProductParamDto
  ): Promise<ApiResponse<any>> {
    const result = await this.productService.findProductById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.product.success',
      data: result
    };
  }

  /** Retrieves an active product by slug for the customer storefront. */
  @Get('slug/:slug')
  async findProductBySlug(
    @Param() params: GetProductSlugParamDto
  ): Promise<ApiResponse<any>> {
    const result = await this.productService.findActiveProductBySlug(
      params.slug
    );

    return {
      status: HttpStatus.OK,
      message: 'message.product.success',
      data: result
    };
  }

  /**
   * Endpoint to bulk import spreadsheet product rows.
   *
   * @param rawData Raw request body object containing the product sheet rows.
   * @returns ApiResponse summarizing created and updated products.
   */
  @UseGuards(JwtAccessGuard)
  @Post('import')
  async importProducts(
    @Body() rawData: Record<string, unknown>
  ): Promise<ApiResponse<any>> {
    const data = this.validatePayload(ImportProductsBodyDto, rawData);
    const result = await this.productService.importProducts(data);

    return {
      status: HttpStatus.OK,
      message: 'message.product.imported',
      data: result
    };
  }

  /**
   * Endpoint to update an existing product by ID with optional new image uploads and unit changes.
   *
   * @param params DTO containing product ID path parameter.
   * @param rawData Raw request body object containing update fields.
   * @param imageFiles Array of newly uploaded multipart image files.
   * @returns ApiResponse containing updated product entity.
   * @throws BadRequestException If no updated data or images are provided.
   */
  @UseGuards(JwtAccessGuard)
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async updateProduct(
    @Param() params: UpdateProductParamDto,
    @Body() rawData: Record<string, unknown>,
    @UploadedFiles() imageFiles: UploadedImageFile[] = []
  ): Promise<ApiResponse<any>> {
    const data = this.validatePayload(UpdateProductBodyDto, rawData);

    if (Object.keys(data).length === 0 && imageFiles.length === 0) {
      throw new BadRequestException('message.product.missing-data');
    }

    const result = await this.productService.updateProduct(
      params.id,
      data,
      imageFiles
    );

    return {
      status: HttpStatus.OK,
      message: 'message.product.updated',
      data: result
    };
  }

  /**
   * Endpoint to delete a product by ID and remove hosted images.
   *
   * @param params DTO containing product ID path parameter.
   * @returns ApiResponse indicating product deletion success.
   */
  @UseGuards(JwtAccessGuard)
  @Delete(':id')
  async removeProduct(
    @Param() params: DeleteProductParamDto
  ): Promise<ApiResponse<null>> {
    await this.productService.removeProduct(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.product.deleted'
    };
  }
}
