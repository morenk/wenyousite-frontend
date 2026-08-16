import React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { useViewerScope } from "@/api/use-viewer-scope";
import {
  clearAuthSession,
  setAuthSession,
  type AuthUser,
} from "@/lib/auth-store";

const user: AuthUser = {
  id: "u1",
  email: "u1@example.com",
  username: "用户一",
  avatar: null,
  role: "USER",
};

beforeEach(() => {
  localStorage.clear();
  clearAuthSession({ announce: false });
});

describe("useViewerScope", () => {
  test("认证恢复后切换查看者维度并重新执行查询", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const scopes: string[] = [];
    const { result } = renderHook(() => {
      const scope = useViewerScope();
      const query = useQuery({
        queryKey: ["viewer-scope-probe", scope],
        queryFn: () => {
          scopes.push(scope);
          return scope;
        },
      });
      return { scope, data: query.data };
    }, { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toBe("anonymous"));
    act(() => setAuthSession(user, "access-token"));
    await waitFor(() => expect(result.current.data).toBe("u1"));

    expect(result.current.scope).toBe("u1");
    expect(scopes).toEqual(["anonymous", "u1"]);
  });
});
