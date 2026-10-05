import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength
} from 'class-validator';

export class GetCategoryParamDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.category.id-is-required' })
  @IsInt({ message: 'message.category.id-must-is-number' })
  id: number;
}

export class CreateCategoryBodyDto {
  @IsDefined({ message: 'message.category.name-is-required' })
  @IsString({ message: 'message.category.name-must-is-string' })
  @IsNotEmpty({ message: 'message.category.name-not-empty' })
  @MaxLength(32, { message: 'message.category.name-max-length-is-32' })
  name: string;

  @IsDefined({ message: 'message.category.slug-is-required' })
  @IsString({ message: 'message.category.slug-must-is-string' })
  @IsNotEmpty({ message: 'message.category.slug-name-not-empty' })
  @MaxLength(32, { message: 'message.category.slug-max-length-is-32' })
  slug: string;
}

export class UpdateCategoryBodyDto extends PartialType(CreateCategoryBodyDto) {}
export class UpdateCategoryParamDto extends GetCategoryParamDto {}
export class DeleteCategoryParamDto extends GetCategoryParamDto {}
