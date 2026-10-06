import type { RpIdentityCollection, RpIdentityState } from "@/api/hooks/use-rp-identities";
export const account = { id: "u1", username: "小明", avatar: "/account-avatar.webp" };
export function role(id = "rp1", nickname = "白鸦", overrides: Partial<RpIdentityState> = {}): RpIdentityState {
  return { threadId: "t1", userId: "u1", enabled: true, eligible: true, canEdit: true, canDelete: true,
    identityId: id, deleted: false, compatibilityIdentity: id === "rp1",
    identity: { id, nickname, avatarMediaId: null, version: 3 },
    display: { id, nickname, avatar: null }, account, identityToken: "token-" + id, ...overrides };
}
export function collection(identities = [role()], overrides: Partial<RpIdentityCollection> = {}): RpIdentityCollection {
  return { threadId: "t1", userId: "u1", enabled: true, eligible: true, canEdit: true,
    activeCount: identities.length, limit: 10, compatibilityIdentityId: "rp1", defaultIdentityId: "rp1",
    identities, account, ...overrides };
}
