import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateStorefrontOrderBodyDto } from 'common/dto/order.dto';
import { ApiResponse } from 'src/types';
import { OrderService } from './order.service';

@Controller('storefront/orders')
export class StorefrontOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  async createOrder(
    @Body() data: CreateStorefrontOrderBodyDto
  ): Promise<ApiResponse<any>> {
    const result = await this.orderService.createStorefrontOrder(data);

    return {
      status: HttpStatus.CREATED,
      message: 'message.order.created',
      data: result
    };
  }
}
