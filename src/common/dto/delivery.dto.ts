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
  IsBoolean,
  ValidateIf
} from 'class-validator';

/* ---------- PARAM DTO ---------- */

export class GetDeliveryParamDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.delivery.id-is-required' })
  @IsInt({ message: 'message.delivery.id-must-is-number' })
  id: number;
}

/* ---------- CREATE DTO ---------- */

export class CreateDeliveryBodyDto {
  @IsDefined({ message: 'message.delivery.name-is-required' })
  @IsString({ message: 'message.delivery.name-must-is-string' })
  @IsNotEmpty({ message: 'message.delivery.name-not-empty' })
  @MaxLength(64, { message: 'message.delivery.name-max-length-is-64' })
  name: string;

  @Transform(({ value }: TransformFnParams): unknown =>
    value === '' ? null : value
  )
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsEmail({}, { message: 'message.delivery.email-invalid' })
  @MaxLength(128, { message: 'message.delivery.email-max-length-is-128' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'message.delivery.phone-must-is-string' })
  @MaxLength(20, { message: 'message.delivery.phone-max-length-is-20' })
  phone?: string;

  @IsOptional()
  @IsBoolean({ message: 'message.delivery.is-active-must-is-boolean' })
  isActive?: boolean;
}

/* ---------- UPDATE DTO ---------- */

export class UpdateDeliveryBodyDto extends PartialType(CreateDeliveryBodyDto) {}

export class UpdateDeliveryParamDto extends GetDeliveryParamDto {}

/* ---------- DELETE DTO ---------- */

export class DeleteDeliveryParamDto extends GetDeliveryParamDto {}
