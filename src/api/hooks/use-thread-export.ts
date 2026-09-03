import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/api/client";
import type { components } from "@/api/types";

export type ThreadExportOptions = components["schemas"]["ThreadExportDto"];

function filenameFromResponse(response: Response, threadId: string) {
  const header = response.headers.get("content-disposition");
  const filename = header?.match(/filename="([^"]+)"/i)?.[1];
  return filename || `wenyou-thread-${threadId}.zip`;
}

export function useThreadExport() {
  return useMutation({
    mutationFn: async ({
      threadId,
      options,
    }: {
      threadId: string;
      options: ThreadExportOptions;
    }) => {
      const { data, error, response } = await apiClient.POST(
        "/api/v1/threads/{id}/export",
        {
          params: { path: { id: threadId } },
          body: options,
          parseAs: "blob",
        },
      );
      if (error) throw error;
      if (!(data instanceof Blob)) throw new Error("主题档案响应为空");
      return { blob: data, filename: filenameFromResponse(response, threadId) };
    },
  });
}
