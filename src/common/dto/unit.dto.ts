import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength
} from 'class-validator';

export class GetUnitParamDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.unit.id-is-required' })
  @IsInt({ message: 'message.unit.id-must-is-number' })
  id: number;
}

export class CreateUnitBodyDto {
  @IsDefined({ message: 'message.unit.name-is-required' })
  @IsString({ message: 'message.unit.name-must-is-string' })
  @IsNotEmpty({ message: 'message.unit.name-not-empty' })
  @MaxLength(32, { message: 'message.unit.name-max-length-is-32' })
  name: string;
}

export class UpdateUnitBodyDto extends PartialType(CreateUnitBodyDto) {}
export class UpdateUnitParamDto extends GetUnitParamDto {}
export class DeleteUnitParamDto extends GetUnitParamDto {}
