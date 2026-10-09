"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { syncThemeDocument, THEME_MEDIA_QUERY } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

/** 不挂载认证、Query、签到和账户下载初始化。 */
export function EmbedEnvironment({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const value = params.get("theme");
  const preference = value === "light" || value === "dark" ? value : "system";
  useEffect(() => {
    const media = window.matchMedia(THEME_MEDIA_QUERY);
    const apply = () => syncThemeDocument(document, preference, media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);
  return <TooltipProvider>{children}</TooltipProvider>;
}
