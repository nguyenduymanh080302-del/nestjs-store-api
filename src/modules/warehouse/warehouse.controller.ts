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
import { WarehouseService } from './warehouse.service';
import { ApiResponse } from 'src/types';
import {
  CreateWarehouseBodyDto,
  DeleteWarehouseParamDto,
  GetWarehouseParamDto,
  UpdateWarehouseBodyDto,
  UpdateWarehouseParamDto
} from 'common/dto/warehouse.dto';
import { WarehouseEntity } from 'common/entities/warehouse.entity';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';

@Controller('warehouse')
export class WarehouseController {
  /**
   * Constructs the WarehouseController instance.
   *
   * @param warehouseService Service handling warehouse management logic.
   */
  constructor(private readonly warehouseService: WarehouseService) {}

  /**
   * Endpoint to create a new warehouse.
   *
   * @param data DTO payload containing warehouse creation attributes.
   * @returns ApiResponse containing created warehouse entity.
   */
  @UseGuards(JwtAccessGuard)
  @Post()
  async createWarehouse(
    @Body() data: CreateWarehouseBodyDto
  ): Promise<ApiResponse<WarehouseEntity>> {
    const result = await this.warehouseService.createWarehouse(data);

    return {
      status: HttpStatus.CREATED,
      message: 'message.warehouse.created',
      data: result
    };
  }

  /**
   * Endpoint to retrieve all warehouses with product inventory summaries.
   *
   * @returns ApiResponse containing list of warehouse entities.
   */
  @Get()
  async findAllWarehouse(): Promise<ApiResponse<WarehouseEntity[]>> {
    const result = await this.warehouseService.findAllWarehouse();

    return {
      status: HttpStatus.OK,
      message: 'message.warehouse.success',
      data: result
    };
  }

  /**
   * Endpoint to find a warehouse by ID.
   *
   * @param params DTO containing warehouse ID path parameter.
   * @returns ApiResponse containing warehouse entity.
   */
  @Get(':id')
  async findWarehouseById(
    @Param() params: GetWarehouseParamDto
  ): Promise<ApiResponse<WarehouseEntity>> {
    const result = await this.warehouseService.findWarehouseById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.warehouse.success',
      data: result
    };
  }

  /**
   * Endpoint to update an existing warehouse by ID.
   *
   * @param params DTO containing warehouse ID path parameter.
   * @param data DTO payload containing updated warehouse fields.
   * @returns ApiResponse containing updated warehouse entity.
   * @throws BadRequestException If update payload is empty.
   */
  @UseGuards(JwtAccessGuard)
  @Patch(':id')
  async updateWarehouse(
    @Param() params: UpdateWarehouseParamDto,
    @Body() data: UpdateWarehouseBodyDto
  ): Promise<ApiResponse<WarehouseEntity>> {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('message.warehouse.missing-data');
    }

    const result = await this.warehouseService.updateWarehouse(params.id, data);

    return {
      status: HttpStatus.OK,
      message: 'message.warehouse.updated',
      data: result
    };
  }

  /**
   * Endpoint to delete a warehouse by ID.
   *
   * @param params DTO containing warehouse ID path parameter.
   * @returns ApiResponse indicating warehouse deletion success.
   */
  @Delete(':id')
  async removeWarehouse(
    @Param() params: DeleteWarehouseParamDto
  ): Promise<ApiResponse<null>> {
    await this.warehouseService.removeWarehouse(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.warehouse.deleted'
    };
  }
}
