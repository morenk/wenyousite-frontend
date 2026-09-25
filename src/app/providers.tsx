"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ViewportToaster as Toaster } from "@/components/ui/viewport-toaster";
import { usePathname } from "next/navigation";
import { bindAdminClient, useAdminSessionLifecycle } from "@/api/hooks/admin/use-admin-auth";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DailyCheckInBootstrap } from "@/components/economy/daily-check-in-bootstrap";
import { ThemeProvider, useTheme } from "@/components/ui/theme-provider";

import { CoverPlaybackNavigation } from "@/components/layout/cover-playback-navigation";

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
  const isStation = (usePathname() ?? "").startsWith("/station");
  const [adminClient] = useState(createQueryClient);
  useEffect(() => bindAdminClient(adminClient), [adminClient]);
  const { resolvedTheme } = useTheme();
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
    <QueryClientProvider key={isStation ? "station" : queryScope.version} client={isStation ? adminClient : queryScope.client}>
      {isStation ? <AdminSessionLifecycle /> : <DailyCheckInBootstrap />}
      {children}
      <Toaster
        theme={resolvedTheme}
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          className: "rounded-[var(--radius-panel)] border-border bg-popover text-popover-foreground shadow-popover",
        }}
      />
    </QueryClientProvider>
  );
}

function AdminSessionLifecycle() {
  useAdminSessionLifecycle();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <AuthProvider>
          <IdentityScopedQueries>
            <ConfirmProvider>
              <TooltipProvider>
                <MotionConfig reducedMotion="user">
                  <Suspense fallback={null}><CoverPlaybackNavigation /></Suspense>
                  {children}
                </MotionConfig>
              </TooltipProvider>
            </ConfirmProvider>
          </IdentityScopedQueries>
        </AuthProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
