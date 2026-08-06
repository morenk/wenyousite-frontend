"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function IdentityScopedQueries({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuth();
  const [queryScope, setQueryScope] = useState(() => ({
    client: createQueryClient(),
    version: 0,
  }));
  const identityRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    const nextIdentity = user?.id ?? "anonymous";
    if (identityRef.current === null) {
      identityRef.current = nextIdentity;
      return;
    }
    if (identityRef.current !== nextIdentity) {
      identityRef.current = nextIdentity;
      setQueryScope((current) => ({
        client: createQueryClient(),
        version: current.version + 1,
      }));
    }
  }, [isInitialized, user?.id]);

  return (
    <QueryClientProvider key={queryScope.version} client={queryScope.client}>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          className: "rounded-xl border-border shadow-lg",
        }}
      />
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <IdentityScopedQueries>{children}</IdentityScopedQueries>
    </AuthProvider>
  );
}
