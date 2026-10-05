import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { GetUser } from 'common/decorators/account.decorator';
import { Permissions } from 'common/decorators/permission.decorator';
import {
  CreateOrderBodyDto,
  DeleteOrderParamDto,
  GetOrderParamDto,
  GetOrdersQueryDto,
  ImportOrdersBodyDto,
  UpdateOrderBodyDto,
  UpdateOrderParamDto
} from 'common/dto/order.dto';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';
import { PermissionGuard } from 'common/guards/permission.guard';
import { ApiResponse } from 'src/types';
import { Permission } from 'utils/enum';
import { OrderService } from './order.service';

@Controller('order')
@UseGuards(JwtAccessGuard, PermissionGuard)
export class OrderController {
  /**
   * Constructs the OrderController instance.
   *
   * @param orderService Service handling sales order creation, querying, and stock deduction logic.
   */
  constructor(private readonly orderService: OrderService) {}

  /**
   * Endpoint to create a new sales order. Requires MANAGE_SALES permission.
   *
   * @param data DTO payload containing order details (orderCode, products, customerId, deliveryId, etc.).
   * @param accountId ID of the authenticated user creating the order.
   * @returns ApiResponse containing created order record.
   */
  @Permissions(Permission.MANAGE_SALES)
  @Post()
  async createOrder(
    @Body() data: CreateOrderBodyDto,
    @GetUser('accountId') accountId: number
  ): Promise<ApiResponse<any>> {
    const result = await this.orderService.createOrder(data, accountId);

    return {
      status: HttpStatus.CREATED,
      message: 'message.order.created',
      data: result
    };
  }

  /** Imports multiple spreadsheet orders in one inventory-safe transaction. */
  @Permissions(Permission.MANAGE_SALES)
  @Post('import')
  async importOrders(
    @Body() data: ImportOrdersBodyDto,
    @GetUser('accountId') accountId: number
  ): Promise<ApiResponse<any>> {
    const result = await this.orderService.importOrders(data, accountId);

    return {
      status: HttpStatus.CREATED,
      message: 'message.order.imported',
      data: result
    };
  }

  /**
   * Endpoint to query and retrieve a paginated list of sales orders. Requires MANAGE_SALES permission.
   *
   * @param query DTO containing pagination parameters (page, limit), status filter, and search text.
   * @returns ApiResponse containing paginated order items and total counts.
   */
  @Permissions(Permission.MANAGE_SALES)
  @Get()
  async findAllOrder(
    @Query() query: GetOrdersQueryDto
  ): Promise<ApiResponse<any>> {
    const result = await this.orderService.findAllOrder(query);

    return {
      status: HttpStatus.OK,
      message: 'message.order.success',
      data: result
    };
  }

  /**
   * Endpoint to retrieve a specific order by ID. Requires MANAGE_SALES permission.
   *
   * @param params DTO containing order ID path parameter.
   * @returns ApiResponse containing order details.
   */
  @Permissions(Permission.MANAGE_SALES)
  @Get(':id')
  async findOrderById(
    @Param() params: GetOrderParamDto
  ): Promise<ApiResponse<any>> {
    const result = await this.orderService.findOrderById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.order.success',
      data: result
    };
  }

  /**
   * Endpoint to update an order by ID. Requires MANAGE_SALES permission.
   *
   * @param params DTO containing order ID path parameter.
   * @param data DTO payload containing updated order properties.
   * @returns ApiResponse containing updated order entity.
   * @throws BadRequestException If update payload is empty.
   */
  @Permissions(Permission.MANAGE_SALES)
  @Patch(':id')
  async updateOrder(
    @Param() params: UpdateOrderParamDto,
    @Body() data: UpdateOrderBodyDto
  ): Promise<ApiResponse<any>> {
    if (!Object.keys(data).length) {
      throw new BadRequestException('message.order.missing-data');
    }

    const result = await this.orderService.updateOrder(params.id, data);

    return {
      status: HttpStatus.OK,
      message: 'message.order.updated',
      data: result
    };
  }

  /**
   * Endpoint to delete an order by ID and restore product stock. Requires MANAGE_SALES permission.
   *
   * @param params DTO containing order ID path parameter.
   * @returns ApiResponse indicating order deletion success.
   */
  @Permissions(Permission.MANAGE_SALES)
  @Delete(':id')
  async removeOrder(
    @Param() params: DeleteOrderParamDto
  ): Promise<ApiResponse<null>> {
    await this.orderService.removeOrder(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.order.deleted'
    };
  }
}
