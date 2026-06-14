import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './auth.guard';
import type { Role } from '@bitecodes/shared';

export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// Role hierarchy: owner > admin > member > viewer
export const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Server-side role-floor check, used where the required role depends on the
 * request body (and so cannot be a static @RequireRole decorator). Fails CLOSED
 * for an unknown / missing role — mirrors the client helper in web rbac.ts.
 */
export function roleAtLeast(current: Role | null | undefined, floor: Role): boolean {
  const rank = current ? ROLE_RANK[current] ?? 0 : 0;
  return rank >= ROLE_RANK[floor];
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const userRole: Role | undefined = (req as any).memberRole;

    if (!userRole) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'No role in this workspace.' });
    }

    const userRank = ROLE_RANK[userRole] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_RANK[r] ?? 0));

    if (userRank < minRequired) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient role for this action.',
      });
    }

    return true;
  }
}
