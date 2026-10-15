import { Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { hash, verify } from 'argon2';
import { randomBytes, createHash } from 'crypto';
import type { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Hash a password using Argon2id with recommended parameters.
   */
  async hashPassword(password: string): Promise<string> {
    return hash(password, {
      type: 2, // argon2id
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify a password against an Argon2id hash.
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Authenticate a user by email and password.
   * Returns the user if credentials are valid, null otherwise.
   */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) return null;

    const valid = await this.verifyPassword(user.password, password);
    if (!valid) return null;

    return user;
  }

  /**
   * Create a new session for a user.
   * Returns the raw session token (stored as SHA-256 hash in DB).
   */
  async createSession(
    userId: number,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ sessionId: string; token: string }> {
    const token = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress,
        userAgent: userAgent.substring(0, 500),
        expiresAt,
      },
    });

    return { sessionId: session.id, token };
  }

  /**
   * Validate a session token and return the associated user.
   */
  async validateSession(token: string): Promise<User | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    // Update last active
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() },
    });

    return session.user;
  }

  /**
   * Revoke a session.
   */
  async revokeSession(sessionId: string, userId: number): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  /**
   * Generate a Wings-compatible WebSocket JWT for console/stats streaming.
   *
   * This JWT is signed with the node's daemon token and contains
   * the claims Wings expects for WebSocket authentication.
   */
  async generateWebSocketToken(
    serverUuid: string,
    nodeId: number,
    userId: number,
    userUuid: string,
    permissions: string[],
  ): Promise<{ token: string; socket: string }> {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      throw new Error('Node not found');
    }

    const panelUrl = this.config.getOrThrow('APP_URL');
    const uniqueId = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    // Sign JWT with the node's daemon token
    const token = this.jwt.sign(
      {
        iss: panelUrl,
        aud: [`${node.fqdn}:${node.daemonPort}`],
        jti: uniqueId,
        iat: now,
        nbf: now,
        exp: now + 600, // 10 minutes
        server_uuid: serverUuid,
        permissions: permissions.includes('*') ? ['*'] : permissions,
        user_uuid: userUuid,
        user_id: userId,
        unique_id: uniqueId,
      },
      {
        secret: node.daemonToken,
      },
    );

    const socket = `${node.scheme === 'https' ? 'wss' : 'ws'}://${node.fqdn}:${node.daemonPort}/api/servers/${serverUuid}/ws`;

    return { token, socket };
  }

  /**
   * Bootstrap the first administrator account.
   * This can only be called once — when no users exist.
   */
  async bootstrapAdmin(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new ConflictException(
        'An administrator account already exists. Bootstrap is only available for the first user.',
      );
    }

    const passwordHash = await this.hashPassword(password);

    return this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        password: passwordHash,
        isAdmin: true,
        emailVerifiedAt: new Date(),
      },
    });
  }
}
