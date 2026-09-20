/** 与后端 tags/tag-name.ts 保持一致；中文范围不包含扩展汉字或 emoji。 */
export const TAG_NAME_PATTERN = /^[a-zA-Z0-9_\u4e00-\u9fff#]+$/;
export const TAG_NAME_MESSAGE = "标签限 1–20 个字，仅支持中文、字母、数字、下划线和 #";
