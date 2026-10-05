import { PartialType } from '@nestjs/mapped-types';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  IsEmail,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  ValidateIf
} from 'class-validator';

/* ---------- PARAM DTO ---------- */

export class GetSupplierParamDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.supplier.id-is-required' })
  @IsInt({ message: 'message.supplier.id-must-is-number' })
  id: number;
}

/* ---------- CREATE DTO ---------- */

export class CreateSupplierBodyDto {
  @IsDefined({ message: 'message.supplier.name-is-required' })
  @IsString({ message: 'message.supplier.name-must-is-string' })
  @IsNotEmpty({ message: 'message.supplier.name-not-empty' })
  @MaxLength(64, { message: 'message.supplier.name-max-length-is-64' })
  name: string;

  @Transform(({ value }: TransformFnParams): unknown =>
    value === '' ? null : value
  )
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsEmail({}, { message: 'message.supplier.email-invalid' })
  @MaxLength(128, { message: 'message.supplier.email-max-length-is-128' })
  email: string;

  @IsOptional()
  @IsString({ message: 'message.supplier.phone-must-is-string' })
  @MaxLength(20, { message: 'message.supplier.phone-max-length-is-20' })
  phone: string;

  @IsOptional()
  @IsString({ message: 'message.supplier.address-must-is-string' })
  @MaxLength(255, { message: 'message.supplier.address-max-length-is-255' })
  address: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debt?: number;
}

/* ---------- UPDATE DTO ---------- */

export class UpdateSupplierBodyDto extends PartialType(CreateSupplierBodyDto) {}

export class UpdateSupplierParamDto extends GetSupplierParamDto {}

/* ---------- DELETE DTO ---------- */

export class DeleteSupplierParamDto extends GetSupplierParamDto {}
