/** 设置/移除头像 API hook（PATCH / DELETE /users/me/avatar，成功后失效 me 缓存） */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export function useSetAvatar() {
  const queryClient = useQueryClient();

  const setAvatar = useMutation({
    mutationFn: async (mediaId: string) => {
      const { data, error } = await apiClient.PATCH("/api/v1/users/me/avatar", {
        body: { mediaId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  const removeAvatar = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.DELETE("/api/v1/users/me/avatar");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  return { setAvatar, removeAvatar };
}
