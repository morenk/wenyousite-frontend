/** 设置/移除个人主页背景图 API hook。 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";

export function useSetProfileCover() {
  const queryClient = useQueryClient();
  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.me });
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
  };

  const setProfileCover = useMutation({
    mutationFn: async (mediaId: string) => {
      const { data, error } = await apiClient.PATCH("/api/v1/users/me/profile-cover", {
        body: { mediaId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateProfile,
  });

  const removeProfileCover = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.DELETE("/api/v1/users/me/profile-cover");
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateProfile,
  });

  return { setProfileCover, removeProfileCover };
}
