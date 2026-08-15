import { iconSvg } from "@wenyousite/foundation/icons";
import { describe, expect, it } from "vitest";

import {
  editorChevronDownSvg,
  editorIconSvg,
  isEditorIconCapability,
} from "@/lib/editor-icons";

describe("editorIconSvg", () => {
  it("让 Crepe 和站内工具栏复用 Foundation 的同一份 SVG", () => {
    expect(editorIconSvg("bold")).toBe(iconSvg("editor.bold"));
    expect(editorIconSvg("dice")).toBe(iconSvg("editor.dice"));
    expect(editorIconSvg("draft")).toBe(iconSvg("editor.content-drafts"));
    expect(editorChevronDownSvg()).toBe(iconSvg("editor.chevron-down"));
  });

  it("保持 Lucide 的无填充描边规则", () => {
    expect(editorIconSvg("quote")).toContain('fill="none"');
    expect(editorIconSvg("quote")).toContain('stroke="currentColor"');
    expect(editorIconSvg("quote")).toContain('stroke-width="2"');
  });

  it.each([
    "bold",
    "italic",
    "strikethrough",
    "inline-code",
    "bullet-list",
    "ordered-list",
    "link",
    "image",
    "quote",
    "hr",
    "dice",
    "draft",
    "more",
  ] as const)("%s 只生成一枚 SVG", (capability) => {
    const svg = editorIconSvg(capability);
    expect(svg.match(/<svg\b/gu)).toHaveLength(1);
    expect(svg.match(/<\/svg>/gu)).toHaveLength(1);
  });

  it("只把具备产品图标语义的能力交给图标菜单", () => {
    expect(isEditorIconCapability("draft")).toBe(true);
    expect(isEditorIconCapability("mention")).toBe(false);
  });
});
