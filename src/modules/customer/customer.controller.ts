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
import { CustomerService } from './customer.service';
import { ApiResponse } from 'src/types';
import {
  CreateCustomerBodyDto,
  DeleteCustomerParamDto,
  GetCustomerParamDto,
  UpdateCustomerBodyDto,
  UpdateCustomerParamDto
} from 'common/dto/customer.dto';
import { CustomerEntity } from 'common/entities/customer.entity';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';

@Controller('customer')
export class CustomerController {
  /**
   * Constructs the CustomerController instance.
   *
   * @param customerService Service handling customer domain operations.
   */
  constructor(private readonly customerService: CustomerService) {}

  /**
   * Endpoint to create a new customer record.
   *
   * @param data DTO payload containing customer creation attributes.
   * @returns ApiResponse containing created customer entity.
   */
  @UseGuards(JwtAccessGuard)
  @Post()
  async createCustomer(
    @Body() data: CreateCustomerBodyDto
  ): Promise<ApiResponse<CustomerEntity>> {
    const result = await this.customerService.createCustomer(data);

    return {
      status: HttpStatus.CREATED,
      message: 'message.customer.created',
      data: result
    };
  }

  /**
   * Endpoint to retrieve all customers sorted by name.
   *
   * @returns ApiResponse containing list of customer entities.
   */
  @Get()
  async findAllCustomer(): Promise<ApiResponse<CustomerEntity[]>> {
    const result = await this.customerService.findAllCustomer();

    return {
      status: HttpStatus.OK,
      message: 'message.customer.success',
      data: result
    };
  }

  /**
   * Endpoint to retrieve a customer by ID.
   *
   * @param params DTO containing customer ID path parameter.
   * @returns ApiResponse containing customer entity.
   */
  @Get(':id')
  async findCustomerById(
    @Param() params: GetCustomerParamDto
  ): Promise<ApiResponse<CustomerEntity>> {
    const result = await this.customerService.findCustomerById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.customer.success',
      data: result
    };
  }

  /**
   * Endpoint to update an existing customer by ID.
   *
   * @param params DTO containing customer ID path parameter.
   * @param data DTO payload containing updated customer fields.
   * @returns ApiResponse containing updated customer entity.
   * @throws BadRequestException If update payload is empty.
   */
  @UseGuards(JwtAccessGuard)
  @Patch(':id')
  async updateCustomer(
    @Param() params: UpdateCustomerParamDto,
    @Body() data: UpdateCustomerBodyDto
  ): Promise<ApiResponse<CustomerEntity>> {
    if (!Object.keys(data).length) {
      throw new BadRequestException('message.customer.missing-data');
    }

    const result = await this.customerService.updateCustomer(params.id, data);

    return {
      status: HttpStatus.OK,
      message: 'message.customer.updated',
      data: result
    };
  }

  /**
   * Endpoint to delete a customer by ID.
   *
   * @param params DTO containing customer ID path parameter.
   * @returns ApiResponse indicating customer deletion success.
   */
  @UseGuards(JwtAccessGuard)
  @Delete(':id')
  async removeCustomer(
    @Param() params: DeleteCustomerParamDto
  ): Promise<ApiResponse<null>> {
    await this.customerService.removeCustomer(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.customer.deleted'
    };
  }
}
