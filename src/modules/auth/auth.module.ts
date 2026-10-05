import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { AccessTokenStrategy } from 'strategies/accessToken.strategy';
import { RefreshTokenStrategy } from 'strategies/refreshToken.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SessionModule } from 'modules/session/session.module';

@Module({
  imports: [
    PrismaModule,
    SessionModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET')
      })
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenStrategy, RefreshTokenStrategy]
})
export class AuthModule {}
