"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

function UserQueryClientProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
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

function IdentityScopedQueries({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuth();
  const identity = isInitialized ? (user?.id ?? "anonymous") : "initializing";
  return <UserQueryClientProvider key={identity}>{children}</UserQueryClientProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <IdentityScopedQueries>{children}</IdentityScopedQueries>
    </AuthProvider>
  );
}
