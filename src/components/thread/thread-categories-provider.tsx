"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  useThreadCategories,
  type ThreadCategoryDefinition,
} from "@/api/hooks/use-thread-categories";
import { LEGACY_THREAD_CATEGORIES } from "@/lib/thread-presentation";

interface ThreadCategoriesValue {
  categories: ThreadCategoryDefinition[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const defaultValue: ThreadCategoriesValue = {
  categories: LEGACY_THREAD_CATEGORIES,
  isLoading: false,
  isError: false,
  refetch: () => undefined,
};

const ThreadCategoriesContext = createContext<ThreadCategoriesValue>(defaultValue);

export function ThreadCategoriesProvider({ children }: { children: ReactNode }) {
  const query = useThreadCategories();
  const value: ThreadCategoriesValue = {
    categories: query.data ?? LEGACY_THREAD_CATEGORIES,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };

  return (
    <ThreadCategoriesContext.Provider value={value}>
      {children}
    </ThreadCategoriesContext.Provider>
  );
}

export function useThreadCategoriesContext() {
  return useContext(ThreadCategoriesContext);
}
