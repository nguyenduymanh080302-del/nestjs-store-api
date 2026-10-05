import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateRoleBodyDto, UpdateRoleBodyDto } from 'common/dto/role.dto';

@Injectable()
export class RoleService {
  /**
   * Constructs the RoleService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new role after ensuring unique code and name.
   *
   * @param payload DTO containing role creation attributes (code, name, permissions).
   * @returns The created role entity.
   * @throws ConflictException If role code or name already exists in the database.
   */
  async createRole(payload: CreateRoleBodyDto) {
    // Check duplicate code
    const existedByCode = await this.prisma.role.findUnique({
      where: { code: payload.code }
    });

    if (existedByCode) {
      throw new ConflictException('message.role.code.duplicated');
    }

    // Check duplicate name
    const existedByName = await this.prisma.role.findUnique({
      where: { name: payload.name }
    });

    if (existedByName) {
      throw new ConflictException('message.role.name.duplicated');
    }

    return this.prisma.role.create({
      data: {
        code: payload.code,
        name: payload.name,
        permissions: payload.permissions ?? []
      }
    });
  }

  /**
   * Retrieves all active roles sorted by creation date in descending order.
   *
   * @returns Array of active role entities.
   */
  async findAllRole() {
    return this.prisma.role.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Finds an active role by its unique ID.
   *
   * @param id The unique identifier of the role.
   * @returns The active role entity if found.
   * @throws NotFoundException If the role does not exist or is inactive.
   */
  async findRoleById(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id }
    });

    if (!role || !role.isActive) {
      throw new NotFoundException('message.role.not-found');
    }

    return role;
  }

  /**
   * Updates an existing active role by ID while checking for code duplication.
   *
   * @param id The unique identifier of the role to update.
   * @param payload DTO containing fields to update in the role.
   * @returns The updated role entity.
   * @throws NotFoundException If the role does not exist or is inactive.
   * @throws ConflictException If the updated code is already used by another role.
   */
  async updateRole(id: number, payload: UpdateRoleBodyDto) {
    const role = await this.prisma.role.findUnique({
      where: { id }
    });

    if (!role || !role.isActive) {
      throw new NotFoundException('message.role.not-found');
    }

    // Check duplicate code
    if (payload.code) {
      const existedCode = await this.prisma.role.findFirst({
        where: {
          code: payload.code,
          NOT: { id }
        }
      });

      if (existedCode) {
        throw new ConflictException('message.role.code.duplicated');
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...payload
      }
    });
  }

  /**
   * Soft-deletes a role by setting isActive to false after checking if accounts are currently assigned to it.
   *
   * @param id The unique identifier of the role to remove.
   * @throws NotFoundException If the role does not exist or is inactive.
   * @throws BadRequestException If the role is currently assigned to one or more accounts.
   */
  async removeRole(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id }
    });

    if (!role || !role.isActive) {
      throw new NotFoundException('message.role.not-found');
    }

    // Check role is being used
    const usedCount = await this.prisma.account.count({
      where: { roleId: id }
    });

    if (usedCount > 0) {
      throw new BadRequestException('message.role.in-use');
    }

    await this.prisma.role.update({
      where: { id },
      data: { isActive: false }
    });
  }
}
