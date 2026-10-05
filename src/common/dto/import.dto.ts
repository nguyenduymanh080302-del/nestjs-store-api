import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsInt,
  Min,
  ValidateNested
} from 'class-validator';

export class ImportProductItemDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.import.product-id-is-required' })
  @IsInt({ message: 'message.import.product-id-must-is-number' })
  productId: number;

  @Type(() => Number)
  @IsDefined({ message: 'message.import.unit-id-is-required' })
  @IsInt({ message: 'message.import.unit-id-must-is-number' })
  unitId: number;

  @Type(() => Number)
  @IsDefined({ message: 'message.import.quantity-is-required' })
  @IsInt({ message: 'message.import.quantity-must-is-number' })
  @Min(1, { message: 'message.import.quantity-min-is-1' })
  quantity: number;
}

export class CreateImportBodyDto {
  @Type(() => Number)
  @IsDefined({ message: 'message.import.warehouse-id-is-required' })
  @IsInt({ message: 'message.import.warehouse-id-must-is-number' })
  warehouseId: number;

  @Type(() => Number)
  @IsDefined({ message: 'message.import.supplier-id-is-required' })
  @IsInt({ message: 'message.import.supplier-id-must-is-number' })
  supplierId: number;

  @IsArray({ message: 'message.import.products-must-is-array' })
  @ArrayMinSize(1, { message: 'message.import.products-min-size-is-1' })
  @ValidateNested({ each: true })
  @Type(() => ImportProductItemDto)
  products: ImportProductItemDto[];
}
