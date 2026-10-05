import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CreateImportBodyDto } from 'common/dto/import.dto';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';
import { ApiResponse } from 'src/types';
import { ImportService } from './import.service';

@Controller('import')
export class ImportController {
  /**
   * Constructs the ImportController instance.
   *
   * @param importService Service handling inventory import transactions.
   */
  constructor(private readonly importService: ImportService) {}

  /**
   * Endpoint to record a new inventory stock import transaction.
   *
   * @param data DTO payload containing warehouseId, supplierId, and imported product items.
   * @returns ApiResponse containing created import transaction record.
   */
  @UseGuards(JwtAccessGuard)
  @Post()
  async createImport(
    @Body() data: CreateImportBodyDto
  ): Promise<ApiResponse<unknown>> {
    const result = await this.importService.createImport(data);
    return {
      status: HttpStatus.CREATED,
      message: 'message.import.created',
      data: result
    };
  }
}
