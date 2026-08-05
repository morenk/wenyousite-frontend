import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { Providers } from "@/app/providers";
import { useAuth } from "@/lib/auth";

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

beforeEach(() => {
  localStorage.setItem("accessToken", "token-u1");
  localStorage.setItem("user", JSON.stringify({
    id: "u1",
    email: "u1@example.com",
    username: "用户一",
    avatar: null,
    role: "USER",
    emailVerified: true,
  }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.dispatchEvent(new Event("auth-change"));
});

describe("Providers 用户缓存隔离", () => {
  test("账号身份变化后重建 QueryClient，不复用前一账号私有缓存", async () => {
    render(<Providers><PrivateQueryProbe /></Providers>);
    await waitFor(() => expect(screen.getByTestId("private-data")).toHaveTextContent("u1"));

    await userEvent.click(screen.getByRole("button", { name: "切换账号" }));

    await waitFor(() => expect(screen.getByTestId("private-data")).toHaveTextContent("u2"));
  });
});
