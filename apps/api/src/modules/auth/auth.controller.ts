import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  Logger,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/auth/login
   * Authenticate with email and password. Returns session cookie.
   */
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const user = await this.authService.validateCredentials(body.email, body.password);

    if (!user) {
      // Log failed attempt
      await this.prisma.auditLog.create({
        data: {
          action: 'auth:login.fail',
          metadata: { email: body.email },
          device: { ip: req.ip, userAgent: req.headers['user-agent'] ?? '' },
        },
      });

      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check if TOTP is enabled — if so, return a challenge token
    if (user.totpEnabled) {
      return {
        data: {
          complete: false,
          confirmationToken: 'totp_required',
          userId: user.id,
        },
      };
    }

    // Create session
    const { token } = await this.authService.createSession(
      user.id,
      req.ip,
      req.headers['user-agent'] ?? '',
    );

    const isHttps =
      req.headers['x-forwarded-proto'] === 'https' ||
      req.protocol === 'https' ||
      process.env.COOKIE_SECURE === 'true' ||
      (process.env.APP_URL?.startsWith('https://') ?? false);

    // Set HttpOnly cookie (SSL or non-SSL safe)
    res.setCookie('session', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    // Log successful login
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth:login.success',
        metadata: {},
        device: { ip: req.ip, userAgent: req.headers['user-agent'] ?? '' },
      },
    });

    return {
      data: {
        complete: true,
        user: {
          id: user.id,
          uuid: user.uuid,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin,
          language: user.language,
          totpEnabled: user.totpEnabled,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      },
    };
  }

  /**
   * POST /api/auth/logout
   * Destroy the current session.
   */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout and destroy session' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    if (req.session) {
      await this.prisma.session.delete({
        where: { id: req.session.id },
      }).catch(() => {});
    }

    res.clearCookie('session', { path: '/' });
  }

  /**
   * GET /api/auth/me
   * Get the current authenticated user.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current user' })
  async me(@Req() req: any) {
    const user = req.user;
    return {
      data: {
        id: user.id,
        uuid: user.uuid,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        language: user.language,
        totpEnabled: user.totpEnabled,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  /**
   * GET /api/auth/sessions
   * List all active sessions for the current user.
   */
  @Get('sessions')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List active sessions' })
  async listSessions(@Req() req: any) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: req.user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActive: 'desc' },
    });

    return {
      data: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActive: s.lastActive.toISOString(),
        isCurrent: s.id === req.session?.id,
      })),
    };
  }

  /**
   * DELETE /api/auth/sessions/:id
   * Revoke a specific session.
   */
  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke a session' })
  async revokeSession(@Req() req: any, @Param('id') sessionId: string) {
    await this.authService.revokeSession(sessionId, req.user.id);
  }
}
