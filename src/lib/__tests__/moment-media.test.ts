import { describe, expect, test } from "vitest";
import { getMomentStaticUrl, isMomentAnimation } from "@/lib/moment-media";
const media = { url: "/original", thumbnailUrl: "/thumbnail", mediumUrl: "/medium", feedUrl: "/feed", animated: false, contentType: "image/webp" };
describe("动态资源选择", () => {
  test("GIF 容器即使标记静态也只用首帧，URL 后缀不参与判断", () => {
    expect(isMomentAnimation({ ...media, contentType: "image/gif" })).toBe(true);
    expect(isMomentAnimation({ ...media, contentType: " IMAGE/GIF " })).toBe(true);
    expect(getMomentStaticUrl({ ...media, animated: true, thumbnailUrl: media.url })).toBeNull();
    expect(getMomentStaticUrl({ ...media, feedUrl: media.url, mediumUrl: "  ", thumbnailUrl: null }, "cover")).toBeNull();
    expect(isMomentAnimation({ ...media, url: "/looks-animated.gif" })).toBe(false);
    expect(isMomentAnimation({ ...media, animated: true })).toBe(true);
    for (const mode of ["cover", "detail", "thumbnail", "sticker", "full"] as const) {
      expect(getMomentStaticUrl({ ...media, contentType: "image/gif" }, mode)).toBe("/thumbnail");
      expect(getMomentStaticUrl({ ...media, animated: true, thumbnailUrl: null }, mode)).toBeNull();
    }
  });
  test("列表只接受派生，静态详情及全屏保留清晰资源", () => {
    expect(getMomentStaticUrl(media, "cover")).toBe("/feed");
    expect(getMomentStaticUrl({ ...media, feedUrl: null }, "cover")).toBe("/medium");
    expect(getMomentStaticUrl({ ...media, feedUrl: null, mediumUrl: null }, "cover")).toBe("/thumbnail");
    expect(getMomentStaticUrl({ url: "/original" }, "cover")).toBeNull();
    expect(getMomentStaticUrl(media)).toBe("/medium");
    expect(getMomentStaticUrl(media, "full")).toBe("/original");
    expect(getMomentStaticUrl(media, "sticker")).toBe("/thumbnail");
    expect(getMomentStaticUrl({ ...media, thumbnailUrl: null }, "sticker")).toBe("/original");
    expect(getMomentStaticUrl({ url: "/unknown" })).toBeNull();
    expect(getMomentStaticUrl({ url: "/unknown", mediumUrl: "/derived" }, "full")).toBe("/derived");
    expect(getMomentStaticUrl({ ...media, mediumUrl: null })).toBe("/thumbnail");
    expect(getMomentStaticUrl({ ...media, mediumUrl: null, thumbnailUrl: null })).toBe("/original");
    expect(getMomentStaticUrl({ ...media, thumbnailUrl: null }, "thumbnail")).toBe("/feed");
    expect(getMomentStaticUrl({ ...media, thumbnailUrl: null, feedUrl: null }, "thumbnail")).toBe("/medium");
    expect(getMomentStaticUrl({ url: "/unknown" }, "thumbnail")).toBeNull();
  });
});
