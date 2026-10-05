import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { StorefrontOrderController } from './storefront-order.controller';

@Module({
  imports: [PrismaModule],
  controllers: [OrderController, StorefrontOrderController],
  providers: [OrderService]
})
export class OrderModule {}
