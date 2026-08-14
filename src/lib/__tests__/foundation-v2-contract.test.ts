import {
  ACCESSIBILITY_CONTRACT,
  FEEDBACK_RESOURCE_STATES,
  OVERLAY_WEB_PROFILE,
} from "@wenyousite/foundation/interaction";
import { LANGUAGE_ACTIONS } from "@wenyousite/foundation/language";
import {
  NAVIGATION_ICONS,
  NAVIGATION_LABELS,
  NAVIGATION_WEB_PROFILE,
} from "@wenyousite/foundation/navigation";
import { WEB_TYPE_SCALE } from "@wenyousite/foundation/typography";
import { describe, expect, test } from "vitest";

describe("Foundation v2.2 public contracts", () => {
  test("exports semantic typography and accessible feedback contracts", () => {
    expect(WEB_TYPE_SCALE.pageTitle).toMatchObject({
      family: "display",
      size: 28,
      weight: 700,
    });
    expect(FEEDBACK_RESOURCE_STATES).toContain("loading-more");
    expect(ACCESSIBILITY_CONTRACT.invariants.asyncAnnouncement).toBe(
      "polite-unless-critical",
    );
  });

  test("keeps overlay layers strictly ordered", () => {
    expect(OVERLAY_WEB_PROFILE.layers).toMatchObject({
      sticky: 30,
      chrome: 40,
      floating: 60,
      popup: 70,
      modalBackdrop: 80,
      modal: 81,
      tooltip: 90,
      nestedPopup: 100,
      globalProgress: 110,
    });
  });

  test("binds stable destinations, icons and action verbs", () => {
    expect(NAVIGATION_WEB_PROFILE.primary).toEqual([
      "discover",
      "moments",
      "search",
    ]);
    expect(NAVIGATION_LABELS.notifications).toBe("通知");
    expect(NAVIGATION_ICONS.notifications).toBe("status.notifications");
    expect(LANGUAGE_ACTIONS).toMatchObject({
      hide: "隐藏",
      restore: "恢复",
      retry: "重试",
    });
  });
});
