import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsDefined,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';

const ORDER_STATUS = [
    'PENDING',
    'CANCELED',
    'DELIVERING',
    'DONE',
] as const;

/* ---------- PARAM DTO ---------- */

export class GetOrderParamDto {
    @Type(() => Number)
    @IsDefined({ message: 'message.order.id-is-required' })
    @IsInt({ message: 'message.order.id-must-is-number' })
    id: number;
}

/* ---------- ITEM DTO ---------- */

export class OrderProductItemDto {
    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: 'message.order.warehouse-id-must-is-number' })
    warehouseId?: number;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.product.product-id-is-required' })
    @IsInt({ message: 'message.order.product.product-id-must-is-number' })
    productId: number;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.product.unit-id-is-required' })
    @IsInt({ message: 'message.order.product.unit-id-must-is-number' })
    unitId: number;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.product.quantity-is-required' })
    @IsInt({ message: 'message.order.product.quantity-must-is-number' })
    @Min(1, { message: 'message.order.product.quantity-min-is-1' })
    quantity: number;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.product.sell-price-is-required' })
    @IsNumber({}, { message: 'message.order.product.sell-price-must-is-number' })
    @Min(0, { message: 'message.order.product.sell-price-min-is-0' })
    sellPrice: number;

    @Type(() => Number)
    @IsOptional()
    @IsNumber({}, { message: 'message.order.product.extra-price-must-is-number' })
    @Min(0, { message: 'message.order.product.extra-price-min-is-0' })
    extraPrice?: number;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.product.vat-percent-is-required' })
    @IsNumber({}, { message: 'message.order.product.vat-percent-must-is-number' })
    @Min(0, { message: 'message.order.product.vat-percent-min-is-0' })
    @Max(100, { message: 'message.order.product.vat-percent-max-is-100' })
    vatPercent: number;
}

/* ---------- CREATE DTO ---------- */

export class CreateOrderBodyDto {
    @IsDefined({ message: 'message.order.order-code-is-required' })
    @IsString({ message: 'message.order.order-code-must-is-string' })
    @IsNotEmpty({ message: 'message.order.order-code-not-empty' })
    @MaxLength(64, { message: 'message.order.order-code-max-length-is-64' })
    orderCode: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'message.order.customer-id-must-is-number' })
    customerId?: number;

    @IsDefined({ message: 'message.order.customer-name-is-required' })
    @IsString({ message: 'message.order.customer-name-must-is-string' })
    @IsNotEmpty({ message: 'message.order.customer-name-not-empty' })
    @MaxLength(128, { message: 'message.order.customer-name-max-length-is-128' })
    customerName: string;

    @IsOptional()
    @IsString({ message: 'message.order.customer-email-must-is-string' })
    @MaxLength(128, { message: 'message.order.customer-email-max-length-is-128' })
    customerEmail?: string;

    @IsDefined({ message: 'message.order.customer-phone-is-required' })
    @IsString({ message: 'message.order.customer-phone-must-is-string' })
    @Matches(/^(03|05|07|08|09)\d{8}$/, {
        message: 'message.order.customer-phone-invalid-vn',
    })
    customerPhone: string;

    @IsDefined({ message: 'message.order.customer-address-is-required' })
    @IsString({ message: 'message.order.customer-address-must-is-string' })
    @IsNotEmpty({ message: 'message.order.customer-address-not-empty' })
    @MaxLength(255, { message: 'message.order.customer-address-max-length-is-255' })
    customerAddress: string;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.customer-payment-is-required' })
    @IsNumber({}, { message: 'message.order.customer-payment-must-is-number' })
    @Min(0, { message: 'message.order.customer-payment-min-is-0' })
    customerPayment: number;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.vat-value-is-required' })
    @IsNumber({}, { message: 'message.order.vat-value-must-is-number' })
    @Min(0, { message: 'message.order.vat-value-min-is-0' })
    vatValue: number;

    @Type(() => Number)
    @IsOptional()
    @IsNumber({}, { message: 'message.order.discount-value-must-is-number' })
    @Min(0, { message: 'message.order.discount-value-min-is-0' })
    discountValue?: number;

    @Type(() => Number)
    @IsDefined({ message: 'message.order.total-amount-is-required' })
    @IsNumber({}, { message: 'message.order.total-amount-must-is-number' })
    @Min(0, { message: 'message.order.total-amount-min-is-0' })
    totalAmount: number;

    @IsOptional()
    @IsIn(ORDER_STATUS, { message: 'message.order.status-invalid' })
    status?: (typeof ORDER_STATUS)[number];

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'message.order.delivery-id-must-is-number' })
    deliveryId?: number;

    @IsOptional()
    @IsString({ message: 'message.order.delivery-person-must-is-string' })
    @MaxLength(128, { message: 'message.order.delivery-person-max-length-is-128' })
    deliveryPerson?: string;

    @IsOptional()
    @IsString({ message: 'message.order.delivery-phone-must-is-string' })
    @Matches(/^(03|05|07|08|09)\d{8}$/, {
        message: 'message.order.delivery-phone-invalid-vn',
    })
    deliveryPhone?: string;

    @Type(() => Number)
    @IsOptional()
    @IsNumber({}, { message: 'message.order.paid-amount-must-is-number' })
    @Min(0, { message: 'message.order.paid-amount-min-is-0' })
    paidAmount?: number;

    @IsArray({ message: 'message.order.products-must-is-array' })
    @ArrayMinSize(1, { message: 'message.order.products-min-size-is-1' })
    @ValidateNested({ each: true })
    @Type(() => OrderProductItemDto)
    products: OrderProductItemDto[];
}

/* ---------- UPDATE DTO ---------- */

export class UpdateOrderBodyDto extends PartialType(CreateOrderBodyDto) { }

export class UpdateOrderParamDto extends GetOrderParamDto { }

export class DeleteOrderParamDto extends GetOrderParamDto { }

/* ---------- QUERY DTO ---------- */

export class GetOrdersQueryDto {
    @IsOptional()
    @IsString({ message: 'message.order.search-must-is-string' })
    search?: string;

    @IsOptional()
    @IsIn(ORDER_STATUS, { message: 'message.order.status-invalid' })
    status?: (typeof ORDER_STATUS)[number];

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'message.order.page-must-is-number' })
    @Min(1, { message: 'message.order.page-min-is-1' })
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'message.order.limit-must-is-number' })
    @Min(1, { message: 'message.order.limit-min-is-1' })
    @Max(100, { message: 'message.order.limit-max-is-100' })
    limit: number = 10;
}
