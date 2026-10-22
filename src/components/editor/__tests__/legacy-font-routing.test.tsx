import { useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useVisibleTextFonts } from "../use-visible-text-fonts";
import { queryKeys } from "@/api/query-keys";
import { rememberDynamicFont } from "@/lib/dynamic-text-font-state";
import { importedTextFontVersion } from "@/lib/legacy-text-font-routing";
import { isPasteAllowedTextFont } from "@/lib/markdown-text-font";
const env = vi.hoisted(() => ({
  dynamic: vi.fn(),
  legacy: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/dynamic-text-font-runtime", () => ({
  dynamicTextFontRuntime: () => ({ watch: env.dynamic }),
}));
vi.mock("@/lib/thread-font-runtime", () => ({
  threadFontRuntime: () => ({ watch: env.legacy, invalidate: vi.fn() }),
}));
vi.mock("@/api/client", () => ({ apiClient: { GET: env.get } }));
function Content() {
  const root = useRef<HTMLDivElement>(null);
  useVisibleTextFonts(root);
  return (
    <div ref={root}>
      <span data-wenyou-font-v1="great-vibes">Aa</span>
    </div>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("先确认能力再加载：旧源固定映射，能力降级不回旧通道，撤回保源并清除呈现", async () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const release = vi.fn();
  env.dynamic.mockImplementation((_id, _text, emit) => {
    emit({ family: "mapped-version", status: "ready" });
    return release;
  });
  let resolve!: (value: unknown) => void;
  env.get.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Content />
    </QueryClientProvider>,
  );
  const span = view.container.querySelector("span")!;
  expect(env.get).toHaveBeenCalledTimes(1);
  expect(env.get.mock.calls[0]![0]).toBe("/api/v1/meta");
  expect(env.legacy).not.toHaveBeenCalled();
  expect(env.dynamic).not.toHaveBeenCalled();
  await act(async () =>
    resolve({ data: { data: { capabilities: { textFontV2Supported: true } } } }),
  );
  const id = importedTextFontVersion("great-vibes")!;
  await waitFor(() =>
    expect(env.dynamic).toHaveBeenCalledWith(id, "Aa", expect.any(Function), undefined),
  );
  for (const capability of [false, undefined]) {
    await act(async () => {
      client.setQueryData(queryKeys.meta, { capabilities: { textFontV2Supported: capability } });
    });
    expect(span).toHaveAttribute("data-font-load", "ready");
  }
  const permission = {
    versionId: id,
    revision: 10,
    status: "disabled" as const,
    selectable: false,
    pasteAllowed: false,
    renderAllowed: true,
  };
  await act(async () => rememberDynamicFont(permission));
  expect(isPasteAllowedTextFont("great-vibes")).toBe(false);
  expect(span).toHaveAttribute("data-font-load", "ready");
  await act(async () =>
    rememberDynamicFont({
      ...permission,
      status: "withdrawn",
      renderAllowed: false,
    }),
  );
  await waitFor(() =>
    expect(span).toHaveAttribute("data-font-load", "fallback"),
  );
  expect(
    span.parentElement!.style.getPropertyValue(
      "--wenyou-content-font-great-vibes",
    ),
  ).not.toContain("mapped-version");
  expect(release).toHaveBeenCalled();
  await act(async () => client.setQueryData(queryKeys.meta, {}));
  expect(span).toHaveAttribute("data-wenyou-font-v1", "great-vibes");
  expect(span).toHaveTextContent("Aa");
  expect(env.legacy).not.toHaveBeenCalled();
  expect(env.get).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});
