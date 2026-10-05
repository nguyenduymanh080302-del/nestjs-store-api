import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getClientIp } from 'common/helper/client-ip.helper';
import { IpCacheInterceptor } from 'common/interceptors/ip-cache.interceptor';
import { AuthModule } from 'modules/auth/auth.module';
import { OrderModule } from 'modules/order/order.module';
import { SessionModule } from 'modules/session/session.module';
import { PrismaModule } from 'prisma/prisma.module';
import { CategoryModule } from './modules/category/category.module';
import { UnitModule } from 'modules/unit/unit.module';
import { SupplierModule } from 'modules/supplier/supplier.module';
import { CustomerModule } from 'modules/customer/customer.module';
import { DeliveryModule } from 'modules/delivery/delivery.module';
import { RoleModule } from 'modules/role/role.module';
import { ProductModule } from 'modules/product/product.module';
import { WarehouseModule } from 'modules/warehouse/warehouse.module';
import { ImportModule } from 'modules/import/import.module';
import { ImageModule } from 'modules/image/image.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = Number(config.get('CACHE_TTL_MS') ?? 30_000);

        return {
          ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 30_000
        };
      }
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = Number(config.get('RATE_LIMIT_TTL_MS') ?? 60_000);
        const limit = Number(config.get('RATE_LIMIT_MAX') ?? 120);

        return [
          {
            ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 60_000,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 120,
            getTracker: (request) => getClientIp(request)
          }
        ];
      }
    }),
    PrismaModule,
    ImageModule,
    AuthModule,
    SessionModule,
    OrderModule,
    CategoryModule,
    UnitModule,
    SupplierModule,
    CustomerModule,
    DeliveryModule,
    RoleModule,
    ProductModule,
    WarehouseModule,
    ImportModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IpCacheInterceptor
    }
  ]
})
export class AppModule {}
