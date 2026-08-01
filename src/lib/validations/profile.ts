/** 个人资料编辑表单校验 schema（对齐后端 UpdateUserDto） */

import { z } from "zod";

/** 主表单：Bio + 隐私开关（不含 username，用户名默认不修改） */
export const profileSchema = z.object({
  bio: z
    .string()
    .max(255, "简介最多 255 个字符")
    .optional(),
  showRecentReplies: z.boolean(),
  showPlayerBadges: z.boolean(),
  showBookmarks: z.boolean(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

/** 独立用户名修改 schema：仅在用户显式进入编辑并改动时校验 */
export const usernameSchema = z.object({
  username: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(24, "用户名最多 24 个字符")
    .regex(/^[a-zA-Z0-9\u4e00-\u9fff]+$/, "用户名只能包含字母、数字和中文"),
});

export type UsernameFormData = z.infer<typeof usernameSchema>;
