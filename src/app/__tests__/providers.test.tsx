import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { Providers } from "@/app/providers";
import { useAuth } from "@/lib/auth";
import { clearAuthSession } from "@/lib/auth-store";

vi.mock("sonner", () => ({ Toaster: () => null }));

function PrivateQueryProbe() {
  const { user, setAuth, isInitialized } = useAuth();
  const privateQuery = useQuery({
    queryKey: ["private-probe"],
    queryFn: async () => user?.id ?? "anonymous",
    enabled: isInitialized,
  });

  return (
    <div>
      <span data-testid="private-data">{privateQuery.data}</span>
      <button
        onClick={() => setAuth({
          id: "u2",
          email: "u2@example.com",
          username: "用户二",
          avatar: null,
          role: "USER",
          emailVerified: true,
        }, "token-u2")}
      >
        切换账号
      </button>
    </div>
  );
}

function PublicQueryProbe({ queryFn }: { queryFn: () => Promise<string> }) {
  const query = useQuery({ queryKey: ["public-probe"], queryFn });
  return <span data-testid="public-data">{query.data}</span>;
}

beforeEach(() => {
  clearAuthSession({ announce: false });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: 0,
    data: {
      accessToken: "token-u1",
      user: {
        id: "u1",
        email: "u1@example.com",
        username: "用户一",
        avatar: null,
        role: "USER",
        emailVerified: true,
      },
    },
  }), { status: 200, headers: { "content-type": "application/json" } })));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  clearAuthSession({ announce: false });
  vi.unstubAllGlobals();
});

describe("Providers 用户缓存隔离", () => {
  test("认证初始化完成时不重复请求公开数据", async () => {
    const queryFn = vi.fn().mockResolvedValue("公开数据");
    render(<Providers><PublicQueryProbe queryFn={queryFn} /></Providers>);

    await waitFor(() => expect(screen.getByTestId("public-data")).toHaveTextContent("公开数据"));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  test("账号身份变化后重建 QueryClient，不复用前一账号私有缓存", async () => {
    render(<Providers><PrivateQueryProbe /></Providers>);
    await waitFor(() => expect(screen.getByTestId("private-data")).toHaveTextContent("u1"));

    await userEvent.click(screen.getByRole("button", { name: "切换账号" }));

    await waitFor(() => expect(screen.getByTestId("private-data")).toHaveTextContent("u2"));
  });
});
