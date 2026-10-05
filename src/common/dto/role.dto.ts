import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

/* ---------- PARAM DTO ---------- */

export class GetRoleParamDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.role.id-is-required' })
  @IsInt({ message: 'message.role.id-must-is-number' })
  id: number;
}

/* ---------- CREATE DTO ---------- */

export class CreateRoleBodyDto {
  @IsDefined({ message: 'message.role.code-is-required' })
  @IsString({ message: 'message.role.code-must-is-string' })
  @IsNotEmpty({ message: 'message.role.code-not-empty' })
  @MaxLength(32, { message: 'message.role.code-max-length-is-32' })
  code: string;

  @IsDefined({ message: 'message.role.name-is-required' })
  @IsString({ message: 'message.role.name-must-is-string' })
  @IsNotEmpty({ message: 'message.role.name-not-empty' })
  @MaxLength(32, { message: 'message.role.name-max-length-is-32' })
  name: string;

  @IsOptional()
  @IsArray({ message: 'message.role.permissions-must-is-array' })
  @IsString({ each: true, message: 'message.role.permissions-must-is-string' })
  permissions?: string[];
}

/* ---------- UPDATE DTO ---------- */

export class UpdateRoleBodyDto extends PartialType(CreateRoleBodyDto) {}

export class UpdateRoleParamDto extends GetRoleParamDto {}

/* ---------- DELETE DTO ---------- */

export class DeleteRoleParamDto extends GetRoleParamDto {}
