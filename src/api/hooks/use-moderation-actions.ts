"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type { components } from "@/api/types";

export interface UserModerationDecision {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  policyCode: string;
  publicExplanation: string;
  active: boolean;
  reversedAt: string | null;
  createdAt: string;
  appeal: {
    id: string;
    statement: string;
    status: "PENDING" | "UPHELD" | "OVERTURNED";
    handledNote: string | null;
    createdAt: string;
    handledAt: string | null;
  } | null;
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: async (body: components["schemas"]["CreateReportDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/reports", { body });
      if (error) throw error;
      return data.data;
    },
  });
}

export function useMyModerationDecisions(userId?: string) {
  return useQuery({
    queryKey: queryKeys.moderationDecisions(userId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/moderation/decisions/mine");
      if (error) throw error;
      return data.data as UserModerationDecision[];
    },
    enabled: Boolean(userId),
  });
}

export function useSubmitModerationAppeal(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["CreateModerationAppealDto"]) => {
      const { data, error } = await apiClient.POST("/api/v1/moderation/appeals", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.moderationDecisions(userId) }),
  });
}
