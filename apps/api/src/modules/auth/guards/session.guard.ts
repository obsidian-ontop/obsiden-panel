import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

/**
 * Guard that authenticates requests using the session cookie.
 * Attaches the authenticated user to req.user.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try session cookie first
    const sessionToken = request.cookies?.session;
    if (sessionToken) {
      const user = await this.authService.validateSession(sessionToken);
      if (user) {
        request.user = user;
        return true;
      }
    }

    // Try Bearer token for API key auth
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // API key validation will be implemented in Phase 5
      // For now, only session auth is supported
    }

    throw new UnauthorizedException('Authentication required.');
  }
}
