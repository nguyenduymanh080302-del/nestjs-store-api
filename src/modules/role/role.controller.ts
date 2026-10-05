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
import { RoleService } from './role.service';
import { ApiResponse } from 'src/types';
import {
  CreateRoleBodyDto,
  DeleteRoleParamDto,
  GetRoleParamDto,
  UpdateRoleBodyDto,
  UpdateRoleParamDto
} from 'common/dto/role.dto';
import { RoleEntity } from 'common/entities/role.entity';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';
import { PermissionGuard } from 'common/guards/permission.guard';
import { Permissions } from 'common/decorators/permission.decorator';
import { Permission } from 'utils/enum';

@Controller('role')
export class RoleController {
  /**
   * Constructs the RoleController instance.
   *
   * @param roleService Service handling user role and permission management logic.
   */
  constructor(private readonly roleService: RoleService) {}

  /**
   * Endpoint to create a new user role with permissions. Requires MANAGE_ACCOUNT permission.
   *
   * @param data DTO payload containing role creation attributes (code, name, permissions).
   * @returns ApiResponse containing created role entity.
   */
  @UseGuards(JwtAccessGuard, PermissionGuard)
  @Permissions(Permission.MANAGE_ACCOUNT)
  @Post()
  async createRole(
    @Body() data: CreateRoleBodyDto
  ): Promise<ApiResponse<RoleEntity>> {
    const result = await this.roleService.createRole(data);

    return {
      status: HttpStatus.CREATED,
      message: 'message.role.created',
      data: result
    };
  }

  /**
   * Endpoint to retrieve all active user roles.
   *
   * @returns ApiResponse containing list of active role entities.
   */
  @Get()
  async findAllRole(): Promise<ApiResponse<RoleEntity[]>> {
    const result = await this.roleService.findAllRole();

    return {
      status: HttpStatus.OK,
      message: 'message.role.success',
      data: result
    };
  }

  /**
   * Endpoint to find a role by ID.
   *
   * @param params DTO containing role ID path parameter.
   * @returns ApiResponse containing role entity.
   */
  @Get(':id')
  async findRoleById(
    @Param() params: GetRoleParamDto
  ): Promise<ApiResponse<RoleEntity>> {
    const result = await this.roleService.findRoleById(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.role.success',
      data: result
    };
  }

  /**
   * Endpoint to update an existing role by ID. Requires MANAGE_ACCOUNT permission.
   *
   * @param params DTO containing role ID path parameter.
   * @param data DTO payload containing updated role attributes.
   * @returns ApiResponse containing updated role entity.
   * @throws BadRequestException If update payload is empty.
   */
  @UseGuards(JwtAccessGuard, PermissionGuard)
  @Permissions(Permission.MANAGE_ACCOUNT)
  @Patch(':id')
  async updateRole(
    @Param() params: UpdateRoleParamDto,
    @Body() data: UpdateRoleBodyDto
  ): Promise<ApiResponse<RoleEntity>> {
    if (!Object.keys(data).length) {
      throw new BadRequestException('message.role.missing-data');
    }

    const result = await this.roleService.updateRole(params.id, data);

    return {
      status: HttpStatus.OK,
      message: 'message.role.updated',
      data: result
    };
  }

  /**
   * Endpoint to soft-delete a role by ID. Requires MANAGE_ACCOUNT permission.
   *
   * @param params DTO containing role ID path parameter.
   * @returns ApiResponse indicating role deletion success.
   */
  @UseGuards(JwtAccessGuard, PermissionGuard)
  @Permissions(Permission.MANAGE_ACCOUNT)
  @Delete(':id')
  async removeRole(
    @Param() params: DeleteRoleParamDto
  ): Promise<ApiResponse<null>> {
    await this.roleService.removeRole(params.id);

    return {
      status: HttpStatus.OK,
      message: 'message.role.deleted'
    };
  }
}
