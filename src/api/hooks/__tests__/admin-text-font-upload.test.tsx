import { cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { useAdminTextFontActions } from "../admin/use-admin-text-fonts";
import {
  acceptAdminSession,
  beginAdminSessionChange,
} from "@/lib/admin-session-store";
import { setAuthSession, clearAuthSession } from "@/lib/auth-store";
afterEach(() => {
  cleanup();
  beginAdminSessionChange();
  clearAuthSession();
  vi.restoreAllMocks();
});
test("真实apiClient上传原始二进制，携带后台CSRF且不携带社区Bearer", async () => {
  const generation = beginAdminSessionChange();
  acceptAdminSession(
    {
      csrfToken: "test-csrf",
      user: { id: "test-admin", role: "ADMIN" },
      session: {
        id: "test-session",
        createdAt: "",
        lastActiveAt: "",
        expiresAt: "2099-01-01T00:00:00Z",
        elevatedUntil: null,
      },
    },
    generation,
  );
  setAuthSession(
    {
      id: "community",
      username: "community",
      email: "test@example.test",
      avatar: null,
      role: "USER",
    },
    "test-community-token",
  );
  let sent: Request | undefined, body: number[] | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    sent = input as Request;
    body = Array.from(new Uint8Array(await sent.arrayBuffer()));
    return new Response(
      JSON.stringify({ code: 0, data: { jobId: "tfj_" + "a".repeat(32) } }),
      { headers: { "content-type": "application/json" } },
    );
  });
  const client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    }),
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  const { result } = renderHook(() => useAdminTextFontActions(), { wrapper }),
    file = new File([new Uint8Array([0, 255, 128, 1])], "font.otf");
  await result.current.upload.mutateAsync({
    familyId: "tff_" + "a".repeat(32),
    file,
    format: "otf",
    expectedFamilyRevision: 7,
  });
  expect(body).toEqual([0, 255, 128, 1]);
  expect(sent!.headers.get("content-type")).toBe("application/octet-stream");
  expect(sent!.headers.get("X-CSRF-Token")).toBe("test-csrf");
  expect(sent!.headers.has("Authorization")).toBe(false);
  expect(new URL(sent!.url).searchParams.get("expectedFamilyRevision")).toBe(
    "7",
  );
  expect(new URL(sent!.url).searchParams.get("format")).toBe("otf");
});
