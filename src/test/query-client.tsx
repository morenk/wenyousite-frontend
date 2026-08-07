import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type QueryClientConfig = NonNullable<ConstructorParameters<typeof QueryClient>[0]>;

/** 为 Hook/组件测试提供一致、无重试且不会被 GC 干扰的 QueryClient。 */
export function createTestQueryClient(config: QueryClientConfig = {}) {
  const { defaultOptions, ...rest } = config;
  return new QueryClient({
    ...rest,
    defaultOptions: {
      ...defaultOptions,
      queries: {
        retry: false,
        gcTime: Infinity,
        ...defaultOptions?.queries,
      },
      mutations: {
        retry: false,
        ...defaultOptions?.mutations,
      },
    },
  });
}

export function createQueryWrapper(client = createTestQueryClient()) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  QueryWrapper.displayName = "TestQueryClientWrapper";
  return { client, Wrapper: QueryWrapper };
}
