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
  UseGuards
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { ApiResponse } from 'src/types';
import {
  CreateDeliveryBodyDto,
  DeleteDeliveryParamDto,
  GetDeliveryParamDto,
  UpdateDeliveryBodyDto,
  UpdateDeliveryParamDto
} from 'common/dto/delivery.dto';
import { DeliveryEntity } from 'common/entities/delivery.entity';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';

@Controller('delivery')
export class DeliveryController {
  /**
   * Constructs the DeliveryController instance.
   *
   * @param deliveryService Service handling delivery partner operations.
   */
  constructor(private readonly deliveryService: DeliveryService) {}

  /**
   * Endpoint to create a new delivery partner record.
   *
   * @param data DTO payload containing delivery entity fields.
   * @returns ApiResponse containing created delivery entity.
   */
  @UseGuards(JwtAccessGuard)
  @Post()
  async createDelivery(
    @Body() data: CreateDeliveryBodyDto
  ): Promise<ApiResponse<DeliveryEntity>> {
    const result = await this.deliveryService.createDelivery(data);

    return {
      status: HttpStatus.CREATED,
      message: 'message.delivery.created',
      data: result
    };
  }

  /**
   * Endpoint to retrieve all delivery partners.
   *
   * @returns ApiResponse containing list of delivery partner entities.
   */
  @Get()
  async findAllDelivery(): Promise<ApiResponse<DeliveryEntity[]>> {
    const result = await this.deliveryService.findAllDelivery();

    return {
      status: HttpStatus.OK,
      message: 'message.delivery.success',
      data: result
    };
  }

  /**
   * Endpoint to find a delivery partner by ID.
   *
   * @param params DTO containing delivery ID path parameter.
   * @returns ApiResponse containing delivery entity.
   */
  @Get(':id')
  async findDeliveryById(
    @Param() params: GetDeliveryParamDto
  ): Promise<ApiResponse<DeliveryEntity>> {
    const result = await this.deliveryService.findDeliveryById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.delivery.success',
      data: result
    };
  }

  /**
   * Endpoint to update a delivery partner record by ID.
   *
   * @param params DTO containing delivery ID path parameter.
   * @param data DTO payload containing fields to update.
   * @returns ApiResponse containing updated delivery entity.
   * @throws BadRequestException If update payload is empty.
   */
  @UseGuards(JwtAccessGuard)
  @Patch(':id')
  async updateDelivery(
    @Param() params: UpdateDeliveryParamDto,
    @Body() data: UpdateDeliveryBodyDto
  ): Promise<ApiResponse<DeliveryEntity>> {
    if (!Object.keys(data).length) {
      throw new BadRequestException('message.delivery.missing-data');
    }

    const result = await this.deliveryService.updateDelivery(params.id, data);

    return {
      status: HttpStatus.OK,
      message: 'message.delivery.updated',
      data: result
    };
  }

  /**
   * Endpoint to delete a delivery partner by ID.
   *
   * @param params DTO containing delivery ID path parameter.
   * @returns ApiResponse indicating delivery deletion success.
   */
  @UseGuards(JwtAccessGuard)
  @Delete(':id')
  async removeDelivery(
    @Param() params: DeleteDeliveryParamDto
  ): Promise<ApiResponse<null>> {
    await this.deliveryService.removeDelivery(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.delivery.deleted'
    };
  }
}
