/**
 * Client-side role ranking.
 *
 * This MIRRORS the server source of truth in
 * `apps/api/src/common/guards/rbac.guard.ts` (`ROLE_RANK`) and the
 * `@bitecodes/shared` `RoleSchema` enum (`owner` > `admin` > `member` > `viewer`).
 *
 * Anything computed from this — e.g. sidebar nav visibility — is COSMETIC ONLY.
 * The real authorization boundary is the server `@RequireRole(...)` guard. If the
 * server ranks ever change, update both. (Phase 2 replaces the hardcoded role with
 * a real value from `GET /v1/me`; the gating mechanism here stays the same.)
 */
export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * True when `current` is at least as privileged as `floor`.
 *
 * An unknown / null / undefined role ranks 0 — strictly below `viewer` — so callers
 * fail CLOSED when the role is not yet known (e.g. during the Phase 1 → 2 gap).
 */
export function roleAtLeast(current: Role | null | undefined, floor: Role): boolean {
  const rank = current ? ROLE_RANK[current] ?? 0 : 0;
  return rank >= ROLE_RANK[floor];
}
