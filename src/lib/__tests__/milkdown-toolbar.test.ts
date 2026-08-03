import { describe, expect, test } from "vitest";
import { syncMilkdownToolbarVisibility } from "@/lib/milkdown-toolbar";

describe("syncMilkdownToolbarVisibility", () => {
  test("上传结束恢复可编辑后清除 Crepe 遗留的隐藏样式", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div class="milkdown-top-bar" style="display: none"></div>';

    syncMilkdownToolbarVisibility(root, false);

    expect(root.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display).toBe("");
  });

  test("只影响当前编辑器宿主内的顶栏", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    first.innerHTML = '<div class="milkdown-top-bar"></div>';
    second.innerHTML = '<div class="milkdown-top-bar"></div>';

    syncMilkdownToolbarVisibility(first, true);

    expect(first.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display).toBe("none");
    expect(second.querySelector<HTMLElement>(".milkdown-top-bar")?.style.display).toBe("");
  });
});
