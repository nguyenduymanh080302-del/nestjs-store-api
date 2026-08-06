import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SigninDto, SignupDto } from 'common/dto/auth.dto';
import { AccountEntity } from 'common/entities/account.entity';
import { sanitizeAccount } from 'common/helper/format.helper';
import { compareHash, hashData } from 'common/helper/hash.helper';
import { Request } from 'express';
import { SessionService } from 'modules/session/session.service';
import { PrismaService } from 'prisma/prisma.service';
import { Permission } from 'utils/enum';

@Injectable()
export class AuthService {
    /**
     * Constructs the AuthService instance.
     *
     * @param prisma Database client service for account and session operations.
     * @param config Service for accessing application environment configuration.
     * @param jwtService Service for signing and verifying JWT tokens.
     * @param sessionService Service for handling user sessions.
     */
    constructor(private prisma: PrismaService, private config: ConfigService, private jwtService: JwtService, private sessionService: SessionService) { }

    /**
     * Retrieves an account by its unique identifier along with role information.
     *
     * @param accountId The unique ID of the account to retrieve.
     * @returns The account record or null if not found.
     */
    async getAccountById(accountId: number) {
        return this.prisma.account.findUnique({
            where: { id: accountId },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                phone: true,
                address: true,
                avatar: true,
                createdAt: true,
                updatedAt: true,
                role: true,
            },
        });
    }

    /**
     * Retrieves an account by its username including role details.
     *
     * @param username The username of the account to search for.
     * @returns The account entity with role details included, or null if not found.
     */
    async getAccountByUsername(username: string) {
        return this.prisma.account.findUnique({
            where: { username: username },
            include: {
                role: true
            }
        })
    }

    /**
     * Generates access and refresh JWT tokens for an account and session.
     *
     * @param account Object containing account id and role.
     * @param sessionId The ID of the current active session.
     * @returns An object containing the generated accessToken and refreshToken.
     */
    async getTokens(account: Pick<AccountEntity, 'id' | 'role'>, sessionId: number) {
        const payload = {
            sub: account.id,
            role: account.role,
            sessionId,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.config.get('ACCESS_TOKEN_SECRET'),
                expiresIn: '1d',
            }),
            this.jwtService.signAsync(payload, {
                secret: this.config.get('REFRESH_TOKEN_SECRET'),
                expiresIn: '30d',
            }),
        ]);

        return { accessToken, refreshToken };
    }


    /**
     * Registers a new account in the system after verifying username uniqueness.
     *
     * @param payload DTO containing signup details (username, password, name, roleId, etc.).
     * @returns Object containing the created accountId.
     * @throws ConflictException If an account with the specified username already exists.
     */
    async signup(payload: SignupDto) {

        const checkExistAccount = await this.getAccountByUsername(payload.username)
        if (checkExistAccount) {
            throw new ConflictException('message.account.duplicated');
        }

        const adminEmail = this.config.get<string>('ADMIN_EMAIL')?.toLowerCase();
        const isAdminRegistration = payload.email?.toLowerCase() === adminEmail;
        const roleCode = isAdminRegistration ? 'admin' : 'employee';
        const rolePermissions = isAdminRegistration
            ? [
                Permission.MANAGE_DASHBOARD,
                Permission.MANAGE_WAREHOUSE,
                Permission.MANAGE_CONTENT,
                Permission.MANAGE_ACCOUNT,
                Permission.MANAGE_SALES,
                Permission.MANAGE_EMPLOYEE,
            ]
            : [];

        const role = await this.prisma.role.upsert({
            where: {
                code: roleCode,
            },
            update: {
                name: roleCode,
                permissions: rolePermissions,
                isActive: true,
            },
            create: {
                code: roleCode,
                name: roleCode,
                permissions: rolePermissions,
                isActive: true,
            },
        });

        const hashedPassword = await hashData(payload.password);
        const newAccount = await this.prisma.account.create({
            data: {
                name: payload.name,
                username: payload.username,
                password: hashedPassword,
                roleId: role.id,
                email: payload.email,
                avatar: payload.avatar,
                phone: payload.phone,
                address: payload.address,
                isActive: isAdminRegistration,
            }
        });
        return { accountId: newAccount.id }
    }

    /**
     * Authenticates a user with username and password, creating a session and returning tokens.
     *
     * @param payload DTO containing signin credentials (username and password).
     * @param req The HTTP Express Request object used to extract IP and User-Agent metadata.
     * @returns Object containing access/refresh tokens and sanitized account information.
     * @throws ForbiddenException If credentials are invalid or account does not exist.
     */
    async signin(payload: SigninDto, req: Request) {
        const { username, password } = payload;

        const account = await this.getAccountByUsername(username)
        if (!account) {
            throw new ForbiddenException('message.account.invalid-credentials');
        }

        const passwordMatched = await compareHash(password, account.password);
        if (!passwordMatched) {
            throw new ForbiddenException('message.account.invalid-credentials');
        }

        const session = await this.sessionService.createEmptySession(
            account.id,
            req,
        );
        const tokens = await this.getTokens(account, session.id);
        await this.sessionService.attachRefreshToken(
            session.id,
            tokens.refreshToken,
        );

        return {
            ...tokens,
            account: sanitizeAccount(account)
        };
    }


    /**
     * Revokes an existing user session on logout.
     *
     * @param sessionId The ID of the session to revoke.
     */
    async logout(sessionId: number) {
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { revoked: true },
        });
    }


    /**
     * Generates a new pair of access and refresh tokens using a valid refresh token.
     *
     * @param accountId ID of the account requesting token refresh.
     * @param sessionId ID of the active session.
     * @param refreshToken Current refresh token string for verification.
     * @returns New access and refresh tokens.
     * @throws UnauthorizedException If account does not exist or session validation fails.
     */
    async refresh(
        accountId: number,
        sessionId: number,
        refreshToken: string,
    ) {
        await this.sessionService.validateSessionForRefresh(
            sessionId,
            refreshToken,
        );
        const account = await this.getAccountById(accountId)
        if (!account)
            throw new UnauthorizedException("message.account.unauthorized")

        const tokens = await this.getTokens(account, sessionId);
        await this.sessionService.attachRefreshToken(
            sessionId,
            tokens.refreshToken,
        );

        return tokens;
    }

}
