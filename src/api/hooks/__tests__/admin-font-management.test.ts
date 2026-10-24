import { afterEach, expect, test, vi } from "vitest";
import { fontOrderRequest, readFontOrder, readFontManagement, type FontManagementItem } from "../admin/use-admin-font-management";
import fixture from "../../../../contracts/admin-font-management-v1-fixtures.json";
const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", () => ({ apiClient: { GET: get } }));
const item = (index: number, language: "zh" | "en" = "zh"): FontManagementItem => ({ familyId: `tff_${index.toString(16).padStart(32, "0")}`, name: `字体${index}`, language, sortOrder: index, revision: index + 1, enabled: true, status: "enabled", currentVersionId: `tfv_${index.toString(16).padStart(32, "0")}`, lastPublishedVersionId: null, latestJob: null, latestSubmissionId: null, createdAt: "", updatedAt: "", publishedAt: null, withdrawnAt: null });
const page = (items: FontManagementItem[], nextCursor: string | null, overrides = {}) => ({ data: { code: 0 as const, message: "ok", data: { items, total: 23, listingRevision: 11, catalogRevision: 9, nextCursor, ...overrides } }, response: new Response() });
afterEach(() => get.mockReset());
test("固定契约版本与分页大小，筛选排序原样交给服务端，不做当前页筛选", async () => {
  expect(fixture.fixtureVersion).toBe(1); expect(fixture.pageSize).toBe(20);
  get.mockResolvedValue(page([item(21)], null));
  const query = { q: "%_名称", language: "en" as const, status: "withdrawn" as const, sort: "updatedAt" as const, direction: "asc" as const, cursor: "opaque" };
  expect((await readFontManagement(query)).items).toEqual([item(21)]);
  expect(get).toHaveBeenCalledExactlyOnceWith("/api/v1/admin/text-fonts/management", { params: { query }, signal: undefined });
});
test("排序读取超过20条的全部可选集合，完整语言一次原子提交且只带变更组", async () => {
  const items = Array.from({ length: 23 }, (_, index) => item(index, index === 22 ? "en" : "zh"));
  get.mockResolvedValueOnce(page(items.slice(0, 20), "second")).mockResolvedValueOnce(page(items.slice(20), null));
  const snapshot = await readFontOrder();
  expect(snapshot.items).toEqual(items); expect(get.mock.calls[1]![1]).toMatchObject({ params: { query: { status: "enabled", sort: "sortOrder", direction: "asc", cursor: "second" } } });
  const order = [items[21]!, ...items.slice(0, 21), items[22]!].map((entry) => entry.familyId);
  const body = fontOrderRequest(snapshot, order);
  expect(body.expectedCatalogRevision).toBe(9); expect(body.groups).toHaveLength(1); expect(body.groups[0]!.items).toHaveLength(22);
  expect(body.groups[0]!.items[0]).toEqual({ familyId: items[21]!.familyId, expectedFamilyRevision: 22 });
  expect(fontOrderRequest(snapshot, items.map((entry) => entry.familyId)).groups).toEqual([]);
  expect(() => fontOrderRequest(snapshot, order.slice(0, 20))).toThrow("集合不完整");
});
test.each([{ catalogRevision: 10 }, { listingRevision: 12 }, { total: 24 }])("分页间快照变化拒绝局部集合：%j", async (change) => {
  get.mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, index) => item(index)), "second")).mockResolvedValueOnce(page([item(20), item(21), item(22)], null, change));
  await expect(readFontOrder()).rejects.toThrow("目录已变化");
});
test("分页游标过期向上保留40931，不能误当空列表", async () => {
  get.mockResolvedValue({ error: { code: 40931, message: "stale", data: null }, response: new Response(null, { status: 409 }) });
  await expect(readFontManagement({ cursor: "stale" })).rejects.toMatchObject({ code: 40931, status: 409 });
});
