import { PartialType } from '@nestjs/mapped-types';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize
} from 'class-validator';

/* ---------- PARAM DTO ---------- */

export class GetProductParamDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.product.id-is-required' })
  @IsInt({ message: 'message.product.id-must-is-number' })
  id: number;
}

export class GetProductSlugParamDto {
  @IsDefined({ message: 'message.product.slug-is-required' })
  @IsString({ message: 'message.product.slug-must-is-string' })
  @IsNotEmpty({ message: 'message.product.slug-not-empty' })
  slug: string;
}

/* ---------- IMAGE DTO ---------- */

export class ProductImageDto {
  @IsDefined({ message: 'message.product.image.url-is-required' })
  @IsString({ message: 'message.product.image.url-must-is-string' })
  @IsNotEmpty({ message: 'message.product.image.url-not-empty' })
  url: string;
}

/* ---------- PRODUCT UNIT DTO ---------- */

export class ProductUnitDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.product.unit.unit-id-is-required' })
  @IsInt({ message: 'message.product.unit.unit-id-must-is-number' })
  unitId: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'message.product.unit.import-price-must-is-number' }
  )
  @Min(0, { message: 'message.product.unit.import-price-min-is-0' })
  importPrice?: number;

  @Type(() => Number)
  @IsDefined({ message: 'message.product.unit.sell-price-is-required' })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'message.product.unit.sell-price-must-is-number' }
  )
  @Min(0, { message: 'message.product.unit.sell-price-min-is-0' })
  sellPrice: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'message.product.unit.vat-percent-must-is-number' }
  )
  @Min(0, { message: 'message.product.unit.vat-percent-min-is-0' })
  @Max(100, { message: 'message.product.unit.vat-percent-max-is-100' })
  vatPercent: number = 0;
}

/* ---------- BODY DTO ---------- */

export class CreateProductBodyDto {
  @IsDefined({ message: 'message.product.name-is-required' })
  @IsString({ message: 'message.product.name-must-is-string' })
  @IsNotEmpty({ message: 'message.product.name-not-empty' })
  @MaxLength(128, { message: 'message.product.name-max-length-is-128' })
  name: string;

  @IsDefined({ message: 'message.product.slug-is-required' })
  @IsString({ message: 'message.product.slug-must-is-string' })
  @IsNotEmpty({ message: 'message.product.slug-not-empty' })
  @MaxLength(128, { message: 'message.product.slug-max-length-is-128' })
  slug: string;

  @IsDefined({ message: 'message.product.description-is-required' })
  @IsString({ message: 'message.product.description-must-is-string' })
  @IsNotEmpty({ message: 'message.product.description-not-empty' })
  description: string;

  @Type(() => Number)
  @IsDefined({ message: 'message.product.category-id-is-required' })
  @IsInt({ message: 'message.product.category-id-must-is-number' })
  categoryId: number;

  @IsOptional()
  @IsBoolean({ message: 'message.product.is-active-must-is-boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsArray({ message: 'message.product.images-must-is-array' })
  @ArrayMinSize(1, { message: 'message.product.images-min-size-is-1' })
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray({ message: 'message.product.units-must-is-array' })
  @ArrayMinSize(1, { message: 'message.product.units-min-size-is-1' })
  @ValidateNested({ each: true })
  @Type(() => ProductUnitDto)
  units?: ProductUnitDto[];
}

export class ImportProductItemDto {
  @IsDefined({ message: 'message.product.name-is-required' })
  @IsString({ message: 'message.product.name-must-is-string' })
  @IsNotEmpty({ message: 'message.product.name-not-empty' })
  @MaxLength(128, { message: 'message.product.name-max-length-is-128' })
  name: string;

  @IsDefined({ message: 'message.product.slug-is-required' })
  @IsString({ message: 'message.product.slug-must-is-string' })
  @IsNotEmpty({ message: 'message.product.slug-not-empty' })
  @MaxLength(128, { message: 'message.product.slug-max-length-is-128' })
  slug: string;

  @IsDefined({ message: 'message.product.description-is-required' })
  @IsString({ message: 'message.product.description-must-is-string' })
  @IsNotEmpty({ message: 'message.product.description-not-empty' })
  description: string;

  @Type(() => Number)
  @IsDefined({ message: 'message.product.category-id-is-required' })
  @IsInt({ message: 'message.product.category-id-must-is-number' })
  categoryId: number;

  @IsOptional()
  @IsBoolean({ message: 'message.product.is-active-must-is-boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsArray({ message: 'message.product.images-must-is-array' })
  @IsString({ each: true })
  images?: string[];
}

export class ImportProductsBodyDto {
  @IsArray({ message: 'message.product.products-must-is-array' })
  @ArrayMinSize(1, { message: 'message.product.products-min-size-is-1' })
  @ArrayMaxSize(1000, { message: 'message.product.products-max-size-is-1000' })
  @ValidateNested({ each: true })
  @Type(() => ImportProductItemDto)
  products: ImportProductItemDto[];
}

/* ---------- UPDATE / DELETE ---------- */

export class UpdateProductBodyDto extends PartialType(CreateProductBodyDto) {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  deleteImageIds?: number[];
}
export class UpdateProductParamDto extends GetProductParamDto {}
export class DeleteProductParamDto extends GetProductParamDto {}

/* ---------- QUERY DTO ---------- */

export class GetProductsQueryDto {
  @IsOptional()
  @IsString({ message: 'message.product.search-must-is-string' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'message.product.category-slug-must-is-string' })
  categorySlug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'message.product.page-must-is-number' })
  @Min(1, { message: 'message.product.page-min-is-1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'message.product.limit-must-is-number' })
  @Min(1, { message: 'message.product.limit-min-is-1' })
  @Max(100, { message: 'message.product.limit-max-is-100' })
  limit: number = 10;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({
    message: 'message.product.is-active-must-is-boolean'
  })
  isActive?: boolean;
}
