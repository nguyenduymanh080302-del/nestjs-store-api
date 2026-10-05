import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class GetWarehouseParamDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.warehouse.id-is-required' })
  @IsInt({ message: 'message.warehouse.id-must-is-number' })
  id: number;
}

export class CreateWarehouseBodyDto {
  @IsDefined({ message: 'message.warehouse.name-is-required' })
  @IsString({ message: 'message.warehouse.name-must-is-string' })
  @IsNotEmpty({ message: 'message.warehouse.name-not-empty' })
  @MaxLength(64, { message: 'message.warehouse.name-max-length-is-64' })
  name: string;

  @IsOptional()
  @IsString({ message: 'message.warehouse.address-must-is-string' })
  @MaxLength(255, { message: 'message.warehouse.address-max-length-is-255' })
  address?: string;

  @IsOptional()
  @IsBoolean({ message: 'message.warehouse.is-active-must-is-boolean' })
  isActive?: boolean;
}

export class UpdateWarehouseBodyDto extends PartialType(
  CreateWarehouseBodyDto
) {}
export class UpdateWarehouseParamDto extends GetWarehouseParamDto {}
export class DeleteWarehouseParamDto extends GetWarehouseParamDto {}
