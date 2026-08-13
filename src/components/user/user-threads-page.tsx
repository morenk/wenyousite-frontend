"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCreatedThreads } from "@/components/user/user-created-threads";
import { UserPlayedThreads } from "@/components/user/user-played-threads";
import { useUserProfilePageContext } from "@/components/user/user-profile-shell";

type ThreadSection = "created" | "played";

/** 用户帖子页：创建与参与使用二级切换，避免两个无限列表纵向堆叠。 */
export function UserThreadsPage({ userId }: { userId: string }) {
  const [section, setSection] = useState<ThreadSection>("created");
  const { canViewPlayedThreads, isSelf } = useUserProfilePageContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">帖子</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {canViewPlayedThreads ? (
          <Tabs
            value={section}
            onValueChange={(value) => setSection(value as ThreadSection)}
            className="gap-4"
          >
            <TabsList variant="line" aria-label="帖子分类" className="h-10 p-0">
              <TabsTrigger value="created" className="px-3">创建的</TabsTrigger>
              <TabsTrigger value="played" className="px-3">参与的</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}

        {section === "played" && canViewPlayedThreads ? (
          <UserPlayedThreads userId={userId} isSelf={isSelf} />
        ) : (
          <UserCreatedThreads userId={userId} />
        )}
      </CardContent>
    </Card>
  );
}
