import type { Country, NameEntry, NameSex } from "./names";

export interface HistoricalSource {
  id: string; title: string; url: string; publisher: string;
  license: string; usePolicy: "fact-reference-only" | "licensed-reuse";
  attribution: string; provenance: string;
}
export interface HistoricalPart extends NameEntry {
  id: string; sourceRefs: string[]; attestedAs: string;
}
export interface HistoricalFamily {
  id: string; forms: { generic?: NameEntry; male?: NameEntry; female?: NameEntry };
  sourceRefs: string[]; attestedAs: string;
  formPolicy?: "grammar-derived";
  lineage?: { label: string; sourceRefs: string[]; evidence: string };
}
export interface HistoricalPatronymic {
  id: string; father: NameEntry; male: NameEntry; female: NameEntry;
  sourceRefs: string[]; attestedAs: string;
}
export type HistoricalRole = "period" | "lineage";
export interface HistoricalProfile {
  id: string; country: Country; label: string;
  period: { from: number; to: number }; region: string;
  namePattern: ("family" | "given" | "patronymic")[];
  originalSeparator: string; zhSeparator: string;
  given: { male: HistoricalPart[]; female: HistoricalPart[] };
  families: HistoricalFamily[];
  roles: { id: HistoricalRole; label: string; familyIds: string[]; period?: { from: number; to: number } }[];
  patronymics?: HistoricalPatronymic[];
  sourceRefs: string[];
}
export interface HistoricalNameData {
  schemaVersion: 1; dataVersion: string; translationPolicy: string;
  sources: HistoricalSource[]; profiles: HistoricalProfile[];
}
export interface HistoricalNameOptions {
  country: Country; profileId: string; role: HistoricalRole; familyId: string;
  sex: NameSex; count: number; includePatronymic: boolean;
}
export interface HistoricalNameEntry extends NameEntry {
  profileId: string; sex: "female" | "male"; familyId: string; givenId: string;
  patronymicId?: string;
}
export async function loadHistoricalNameData(): Promise<HistoricalNameData> {
  return (await import("./historical-name-data.json")).default as HistoricalNameData;
}
export function generateHistoricalNames(
  data: HistoricalNameData, options: HistoricalNameOptions, random: () => number = Math.random,
): HistoricalNameEntry[] {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) throw new Error("生成数量须为 1–50 的整数");
  if (!["any", "male", "female"].includes(options.sex)) throw new Error("请选择有效的名字性别倾向");
  const profile = data.profiles.find((item) => item.id === options.profileId && item.country === options.country);
  if (!profile) throw new Error("请选择有效的时代与地区");
  const role = profile.roles.find((item) => item.id === options.role);
  if (!role) throw new Error("该时代没有此类姓名");
  const families = role.familyIds.map((id) => profile.families.find((item) => item.id === id)!);
  const selectedFamily = options.familyId ? families.find((item) => item.id === options.familyId) : undefined;
  if (options.familyId && !selectedFamily) throw new Error("请选择当前时代收录的姓氏");
  if (options.includePatronymic && !profile.patronymics?.length) throw new Error("该时代不支持父称");
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
  const results = new Map<string, HistoricalNameEntry>();
  for (let attempt = 0; results.size < options.count && attempt < options.count * 40; attempt++) {
    const sex = options.sex === "any" ? (random() < 0.5 ? "female" : "male") : options.sex;
    const family = selectedFamily ?? pick(families);
    const familyForm = family.forms[sex] ?? family.forms.generic!;
    const given = pick(profile.given[sex]);
    const patronymic = options.includePatronymic ? pick(profile.patronymics!) : undefined;
    const parts = { family: familyForm, given, patronymic: patronymic?.[sex] };
    const ordered = profile.namePattern.map((key) => parts[key]).filter((item): item is NameEntry => !!item);
    const original = ordered.map((item) => item.original).join(profile.originalSeparator);
    if (!results.has(original)) results.set(original, {
      original, zh: ordered.map((item) => item.zh).join(profile.zhSeparator),
      profileId: profile.id, sex, familyId: family.id, givenId: given.id,
      ...(patronymic ? { patronymicId: patronymic.id } : {}),
    });
  }
  return [...results.values()];
}
