/** 我的草稿箱：未发布帖列表，可继续编辑或删除 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DraftList } from "@/components/user/draft-list";

export default function DraftsPage() {
  const { user, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, isInitialized, router]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-foreground">我的草稿</h1>
      <DraftList />
    </div>
  );
}
