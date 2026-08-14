import type { AdminContentType } from "@/api/admin-types";

export interface AdminContentReference {
  type: AdminContentType;
  id: string;
}

function asUrl(value: string) {
  try {
    return new URL(value, "https://wenyou.site");
  } catch {
    return null;
  }
}

/** 将站内内容链接或裸编号归一为站务处置目标。 */
export function parseAdminContentReference(
  value: string,
  fallbackType: AdminContentType,
): AdminContentReference | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!normalized.includes("/") && !normalized.includes("?") && !normalized.includes("#")) {
    return { type: fallbackType, id: normalized };
  }

  const url = asUrl(normalized);
  if (!url) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const threadIndex = segments.indexOf("threads");
  const momentIndex = segments.indexOf("moments");

  if (threadIndex >= 0 && segments[threadIndex + 1]) {
    const postId = url.searchParams.get("post");
    if (postId) return { type: "post", id: postId };
    const postIndex = segments.indexOf("posts", threadIndex + 2);
    if (postIndex >= 0 && segments[postIndex + 1]) {
      return { type: "post", id: decodeURIComponent(segments[postIndex + 1]) };
    }
    return { type: "thread", id: decodeURIComponent(segments[threadIndex + 1]) };
  }

  if (momentIndex >= 0 && segments[momentIndex + 1]) {
    const replyId = url.searchParams.get("reply");
    const commentId = replyId ?? url.searchParams.get("comment");
    if (commentId) return { type: "moment_comment", id: commentId };
    return { type: "moment", id: decodeURIComponent(segments[momentIndex + 1]) };
  }

  return null;
}
