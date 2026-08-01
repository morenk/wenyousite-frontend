/** 个人资料编辑表单校验 schema（对齐后端 UpdateUserDto） */

import { z } from "zod";

export const profileSchema = z.object({
  username: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(24, "用户名最多 24 个字符")
    .regex(/^[a-zA-Z0-9\u4e00-\u9fff]+$/, "用户名只能包含字母、数字和中文"),
  bio: z
    .string()
    .max(255, "简介最多 255 个字符")
    .optional(),
  showRecentReplies: z.boolean(),
  showPlayerBadges: z.boolean(),
  showBookmarks: z.boolean(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
