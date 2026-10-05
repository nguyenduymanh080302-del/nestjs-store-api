import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { GetUser } from 'common/decorators/account.decorator';
import { SigninDto, SignupDto } from 'common/dto/auth.dto';
import { JwtAccessGuard } from 'common/guards/jwt-access.guard';
import { JwtRefreshGuard } from 'common/guards/jwt-refresh.guard';
import type { Request } from 'express';
import { ApiResponse } from 'src/types';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';

type AccountDetails = NonNullable<
  Awaited<ReturnType<AuthService['getAccountById']>>
>;

@Controller('auth')
export class AuthController {
  /**
   * Constructs the AuthController instance.
   *
   * @param authService Service handling authentication and account domain operations.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint for user account registration.
   *
   * @param payload DTO containing signup fields (username, password, name, roleId, etc.).
   * @returns ApiResponse containing created account ID.
   */
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async signup(
    @Body() payload: SignupDto
  ): Promise<ApiResponse<{ accountId: number }>> {
    const data = await this.authService.signup(payload);
    return {
      status: HttpStatus.CREATED,
      message: 'message.account.created',
      data
    };
  }

  /**
   * Endpoint for user sign-in authentication.
   *
   * @param payload DTO containing signin credentials (username and password).
   * @param req Express Request object to retrieve client user-agent and IP.
   * @returns ApiResponse containing tokens and account data.
   */
  @Post('signin')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() payload: SigninDto,
    @Req() req: Request
  ): Promise<ApiResponse<Awaited<ReturnType<AuthService['signin']>>>> {
    const data = await this.authService.signin(payload, req);
    return {
      status: HttpStatus.OK,
      message: 'message.account.signin-success',
      data
    };
  }

  /**
   * Endpoint to log out and revoke current session.
   *
   * @param sessionId Session ID extracted from JWT access token.
   * @returns ApiResponse indicating logout success.
   */
  @UseGuards(JwtAccessGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @GetUser('sessionId') sessionId: number
  ): Promise<ApiResponse<null>> {
    await this.authService.logout(sessionId);
    return {
      status: HttpStatus.OK,
      message: 'message.account.logout-success'
    };
  }

  /**
   * Endpoint to retrieve current authenticated user details.
   *
   * @param accountId Account ID extracted from access token payload.
   * @returns ApiResponse containing account details without password hash.
   * @throws UnauthorizedException If account ID is missing or invalid.
   */
  @UseGuards(JwtAccessGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getAccountByToken(
    @GetUser('accountId') accountId: number
  ): Promise<ApiResponse<AccountDetails>> {
    if (!accountId) {
      throw new UnauthorizedException('message.account.id-not-found');
    }
    const data = await this.authService.getAccountById(accountId);
    if (!data) {
      throw new UnauthorizedException('message.account.unauthorized');
    }

    return {
      status: HttpStatus.OK,
      message: 'message.account.is-authenticated',
      data
    };
  }

  /**
   * Endpoint to refresh access and refresh tokens using a valid refresh token.
   *
   * @param accountId Account ID extracted from refresh token payload.
   * @param sessionId Session ID extracted from refresh token payload.
   * @param refreshToken Refresh token string from authorization header.
   * @returns ApiResponse containing new access and refresh tokens.
   */
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @GetUser('accountId') accountId: number,
    @GetUser('sessionId') sessionId: number,
    @GetUser('refreshToken') refreshToken: string
  ): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    const data = await this.authService.refresh(
      accountId,
      sessionId,
      refreshToken
    );

    return {
      status: HttpStatus.OK,
      message: 'message.account.refresh-success',
      data
    };
  }
}
