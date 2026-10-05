import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { hashData, compareHash } from 'common/helper/hash.helper';
import dayjs from 'dayjs';
import { Request } from 'express';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class SessionService {
  /**
   * Constructs the SessionService instance.
   *
   * @param prisma Database service instance for Prisma ORM.
   */
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves a session by its unique ID.
   *
   * @param sessionId The unique identifier of the session.
   * @returns The session entity or null if not found.
   */
  async getSessionById(sessionId: number) {
    return this.prisma.session.findUnique({
      where: { id: sessionId }
    });
  }

  /**
   * Creates a new session record with user agent, IP address, and 30-day absolute expiration date.
   *
   * @param accountId ID of the account starting the session.
   * @param req Express Request object containing HTTP headers (user-agent) and IP address.
   * @returns The created session entity.
   */
  async createEmptySession(accountId: number, req: Request) {
    return this.prisma.session.create({
      data: {
        accountId,
        refreshToken: '',
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: dayjs().add(30, 'day').toDate(), // absolute
        lastUsedAt: new Date(), // idle start
        revoked: false
      }
    });
  }

  /**
   * Hashes and attaches/rotates a refresh token for an active session.
   *
   * @param sessionId ID of the session to update.
   * @param refreshToken Raw refresh token string to be hashed and saved.
   * @returns The updated session entity.
   */
  async attachRefreshToken(sessionId: number, refreshToken: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshToken: await hashData(refreshToken),
        lastUsedAt: new Date()
      }
    });
  }

  /**
   * Validates session state, checking absolute expiration, 10-day idle timeout, and refresh token match.
   *
   * @param sessionId Unique ID of the session.
   * @param refreshToken Refresh token string provided by client.
   * @returns The valid session entity.
   * @throws UnauthorizedException If session is revoked, expired, idle-timed-out, or refresh token is reused/invalid.
   */
  async validateSessionForRefresh(sessionId: number, refreshToken: string) {
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.revoked) {
      throw new UnauthorizedException('message.session.timeout');
    }

    // absolute expiry (30 days)
    if (now > session.expiresAt) {
      await this.revokeSession(sessionId);
      throw new UnauthorizedException('message.session.timeout');
    }

    // idle timeout (10 days)
    if (dayjs(now).diff(session.lastUsedAt, 'day') >= 10) {
      await this.revokeSession(sessionId);
      throw new UnauthorizedException('message.session.timeout');
    }

    const tokenMatched = await compareHash(refreshToken, session.refreshToken);

    if (!tokenMatched) {
      // refresh-token reuse protection
      await this.revokeSession(sessionId);
      throw new UnauthorizedException('message.session.invalid');
    }

    return session;
  }

  /**
   * Marks a session as revoked.
   *
   * @param sessionId Unique ID of the session to revoke.
   */
  async revokeSession(sessionId: number) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revoked: true }
    });
  }

  /**
   * Scheduled cron job running daily at 03:00 AM to remove revoked, absolute expired, and idle timed-out sessions.
   */
  @Cron('0 3 * * *')
  async cleanupSessions() {
    const now = new Date();

    await this.prisma.session.deleteMany({
      where: {
        OR: [
          // revoked session
          { revoked: true },

          // absolute expired
          {
            expiresAt: {
              lt: now
            }
          },

          // idle timeout (10 days)
          {
            lastUsedAt: {
              lt: dayjs(now).subtract(10, 'day').toDate()
            }
          }
        ]
      }
    });
  }
}
