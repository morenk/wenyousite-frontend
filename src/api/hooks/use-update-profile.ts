/** 修改个人资料 API hook（PATCH /users/me：username/bio/隐私开关） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export interface UpdateProfileArgs {
  username?: string;
  bio?: string;
  showRecentReplies?: boolean;
  showPlayerBadges?: boolean;
  showBookmarks?: boolean;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: UpdateProfileArgs) => {
      const { data, error } = await apiClient.PATCH("/api/v1/users/me", {
        body: args,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
