import { describe, expect, test } from "vitest";
import { editSchema as schema0 } from "./category-edit-dialog";
import { categorySchema as schema1 } from "./taxonomy-panel";
import { reasonSchema as schema2 } from "./admin-content-moderation-dialog";
import { reasonSchema as schema3 } from "./content-detail-panel";
import { formSchema as schema4 } from "./content-moderation-panel";
import { restoreSchema as schema5 } from "./hidden-content-list";
import { schema as schema6 } from "./operations-settings-panel";
import { schema as schema7 } from "./announcements-panel";
import { sanctionSchema as schema8 } from "./user-account-state";
import { resolutionSchema as schema9 } from "./case-workbench";

describe("后台文本与后端DTO的Unicode边界", () => {
  test("category-edit-dialog.name接受50码点并拒绝超限", () => {
    expect(schema0.shape.name.safeParse("😀".repeat(50)).success).toBe(true);
    expect(schema0.shape.name.safeParse("😀".repeat(51)).success).toBe(false);
  });
  test("category-edit-dialog.description接受200码点并拒绝超限", () => {
    expect(schema0.shape.description.safeParse("😀".repeat(200)).success).toBe(true);
    expect(schema0.shape.description.safeParse("😀".repeat(201)).success).toBe(false);
  });
  test("taxonomy-panel.name接受50码点并拒绝超限", () => {
    expect(schema1.shape.name.safeParse("😀".repeat(50)).success).toBe(true);
    expect(schema1.shape.name.safeParse("😀".repeat(51)).success).toBe(false);
  });
  test("admin-content-moderation-dialog.reason接受500码点并拒绝超限", () => {
    expect(schema2.shape.reason.safeParse("😀".repeat(500)).success).toBe(true);
    expect(schema2.shape.reason.safeParse("😀".repeat(501)).success).toBe(false);
  });
  test("content-detail-panel.reason接受500码点并拒绝超限", () => {
    expect(schema3.shape.reason.safeParse("😀".repeat(500)).success).toBe(true);
    expect(schema3.shape.reason.safeParse("😀".repeat(501)).success).toBe(false);
  });
  test("content-moderation-panel.reason接受500码点并拒绝超限", () => {
    expect(schema4.shape.reason.safeParse("😀".repeat(500)).success).toBe(true);
    expect(schema4.shape.reason.safeParse("😀".repeat(501)).success).toBe(false);
  });
  test("hidden-content-list.reason接受500码点并拒绝超限", () => {
    expect(schema5.shape.reason.safeParse("😀".repeat(500)).success).toBe(true);
    expect(schema5.shape.reason.safeParse("😀".repeat(501)).success).toBe(false);
  });
  test("operations-settings-panel.maintenanceTitle接受60码点并拒绝超限", () => {
    expect(schema6.shape.maintenanceTitle.safeParse("😀".repeat(60)).success).toBe(true);
    expect(schema6.shape.maintenanceTitle.safeParse("😀".repeat(61)).success).toBe(false);
  });
  test("operations-settings-panel.maintenanceContent接受500码点并拒绝超限", () => {
    expect(schema6.shape.maintenanceContent.safeParse("😀".repeat(500)).success).toBe(true);
    expect(schema6.shape.maintenanceContent.safeParse("😀".repeat(501)).success).toBe(false);
  });
  test("announcements-panel.title接受60码点并拒绝超限", () => {
    expect(schema7.shape.title.safeParse("😀".repeat(60)).success).toBe(true);
    expect(schema7.shape.title.safeParse("😀".repeat(61)).success).toBe(false);
  });
  test("announcements-panel.content接受1000码点并拒绝超限", () => {
    expect(schema7.shape.content.safeParse("😀".repeat(1000)).success).toBe(true);
    expect(schema7.shape.content.safeParse("😀".repeat(1001)).success).toBe(false);
  });
  test("user-account-state.reason接受500码点并拒绝超限", () => {
    expect(schema8.shape.reason.safeParse("😀".repeat(500)).success).toBe(true);
    expect(schema8.shape.reason.safeParse("😀".repeat(501)).success).toBe(false);
  });
  test("case-workbench.publicExplanation接受500码点并拒绝超限", () => {
    expect(schema9.shape.publicExplanation.safeParse("😀".repeat(500)).success).toBe(true);
    expect(schema9.shape.publicExplanation.safeParse("😀".repeat(501)).success).toBe(false);
  });
  test("case-workbench.internalNote接受1000码点并拒绝超限", () => {
    expect(schema9.shape.internalNote.safeParse("😀".repeat(1000)).success).toBe(true);
    expect(schema9.shape.internalNote.safeParse("😀".repeat(1001)).success).toBe(false);
  });
  test("处置理由与公开说明允许后端支持的单字说明", () => {
    expect(schema8.shape.reason.safeParse("查").success).toBe(true);
    expect(schema9.shape.publicExplanation.safeParse("查").success).toBe(true);
  });
});
