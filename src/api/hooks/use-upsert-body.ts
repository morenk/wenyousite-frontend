/** 写入子贴正文 API hook（upsert：无正文创建，有正文乐观锁更新） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateChangedMentionCandidates } from "./use-mention-candidates";
import { markdownWriteCapability } from "@/api/markdown-capability";
import { apiClient } from "@/api/client";
import { applySavedPost, watchPostWriteSession } from "@/api/post-write-cache";
import type { components } from "@/api/types";

export type UpsertedBody = components["schemas"]["PostResponseDto"];

export function useUpsertBody() {
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: watchPostWriteSession,
    mutationFn: async (input: components["schemas"]["UpsertBodyDto"] & { subthreadId: string; threadId: string }) => {
      const { subthreadId, content, version, identityMode, identityId, identityToken, markdownContractVersion, textColorVersion, textFontVersion } = input;
      const capability = { ...markdownWriteCapability(queryClient),
        ...(Object.hasOwn(input, "markdownContractVersion") ? { markdownContractVersion } : {}),
        ...(Object.hasOwn(input, "textFontVersion") ? { textFontVersion } : {}),
        ...(Object.hasOwn(input, "textColorVersion") ? { textColorVersion } : {}),
      };
      const { data, error } = await apiClient.PUT(
        "/api/v1/subthreads/{subthreadId}/body",
        {
          params: { path: { subthreadId } },
          body: { ...capability, content, version, identityMode, identityId, identityToken },
        },
      );
      if (error) throw error;
      if (!data) throw new Error("保存正文响应为空");
      return data.data;
    },
    onError: (error) => invalidateChangedMentionCandidates(queryClient, error),
    onSuccess: (data, variables, session) => session && applySavedPost(queryClient,
      { ...data, kind: "BODY", threadId: variables.threadId, subthreadId: variables.subthreadId }, session),
    onSettled: (_data, _error, _variables, session) => session?.dispose(),
  });
}
