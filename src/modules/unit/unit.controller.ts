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
import { UnitService } from './unit.service';
import { ApiResponse } from 'src/types';
import {
  CreateUnitBodyDto,
  DeleteUnitParamDto,
  GetUnitParamDto,
  UpdateUnitBodyDto,
  UpdateUnitParamDto
} from 'common/dto/unit.dto';
import { UnitEntity } from 'common/entities/unit.entity';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';

@Controller('unit')
export class UnitController {
  /**
   * Constructs the UnitController instance.
   *
   * @param unitService Service handling measurement unit operations.
   */
  constructor(private readonly unitService: UnitService) {}

  /**
   * Endpoint to create a new measurement unit.
   *
   * @param data DTO payload containing unit creation fields (name, description, etc.).
   * @returns ApiResponse containing created unit entity.
   */
  @UseGuards(JwtAccessGuard)
  @Post()
  async createUnit(
    @Body() data: CreateUnitBodyDto
  ): Promise<ApiResponse<UnitEntity>> {
    const result = await this.unitService.createUnit(data);

    return {
      status: HttpStatus.CREATED,
      message: 'message.unit.created',
      data: result
    };
  }

  /**
   * Endpoint to retrieve all measurement units.
   *
   * @returns ApiResponse containing list of unit entities.
   */
  @Get()
  async findAllUnit(): Promise<ApiResponse<UnitEntity[]>> {
    const result = await this.unitService.findAllUnit();

    return {
      status: HttpStatus.OK,
      message: 'message.unit.success',
      data: result
    };
  }

  /**
   * Endpoint to find a measurement unit by ID.
   *
   * @param params DTO containing unit ID path parameter.
   * @returns ApiResponse containing unit entity.
   */
  @Get(':id')
  async findUnitById(
    @Param() params: GetUnitParamDto
  ): Promise<ApiResponse<UnitEntity>> {
    const result = await this.unitService.findUnitById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.unit.success',
      data: result
    };
  }

  /**
   * Endpoint to update a measurement unit by ID.
   *
   * @param params DTO containing unit ID path parameter.
   * @param data DTO payload containing updated unit fields.
   * @returns ApiResponse containing updated unit entity.
   * @throws BadRequestException If unit name is missing in update payload.
   */
  @UseGuards(JwtAccessGuard)
  @Patch(':id')
  async updateUnit(
    @Param() params: UpdateUnitParamDto,
    @Body() data: UpdateUnitBodyDto
  ): Promise<ApiResponse<UnitEntity>> {
    if (!data.name) {
      throw new BadRequestException('message.unit.missing-data');
    }

    const result = await this.unitService.updateUnit(params.id, data);

    return {
      status: HttpStatus.OK,
      message: 'message.unit.updated',
      data: result
    };
  }

  /**
   * Endpoint to delete a measurement unit by ID.
   *
   * @param params DTO containing unit ID path parameter.
   * @returns ApiResponse indicating unit deletion success.
   */
  @Delete(':id')
  async removeUnit(
    @Param() params: DeleteUnitParamDto
  ): Promise<ApiResponse<null>> {
    await this.unitService.removeUnit(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.unit.deleted'
    };
  }
}
