"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DailyCheckInBootstrap } from "@/components/economy/daily-check-in-bootstrap";

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
          className: "rounded-lg border-border bg-popover text-popover-foreground shadow-popover",
        }}
      />
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <AuthProvider>
        <IdentityScopedQueries>
          <ConfirmProvider>
            <TooltipProvider>
              <MotionConfig reducedMotion="user">
                <DailyCheckInBootstrap />
                {children}
              </MotionConfig>
            </TooltipProvider>
          </ConfirmProvider>
        </IdentityScopedQueries>
      </AuthProvider>
    </NuqsAdapter>
  );
}
