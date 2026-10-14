import type { Country, NameEntry, NameSex } from "./names";
import type {
  HistoricalFamily, HistoricalPart, HistoricalPatronymic, HistoricalSource,
} from "./historical-names";

export type AdvancedNameMode = "historical" | "literary";
export interface AdvancedSource extends Omit<HistoricalSource, "usePolicy"> {
  usePolicy: HistoricalSource["usePolicy"] | "original-composition";
}
export interface AdvancedNameStructure {
  id: string;
  label: string;
  originalTemplate: string;
  zhTemplate: string;
}
export interface AdvancedNameStyle {
  id: string;
  country: Country;
  mode: AdvancedNameMode;
  label: string;
  period?: { from: number; to: number };
  region?: string;
  identity?: string;
  provenance: string;
  sourceRefs: string[];
  defaultStructureId: string;
  structures: AdvancedNameStructure[];
  given: { male: HistoricalPart[]; female: HistoricalPart[] };
  families: HistoricalFamily[];
  patronymics?: HistoricalPatronymic[];
  bynames?: { male: HistoricalPart[]; female: HistoricalPart[] };
}
export interface AdvancedNameData {
  schemaVersion: 2;
  dataVersion: string;
  translationPolicy: string;
  sources: AdvancedSource[];
  styles: AdvancedNameStyle[];
}
export interface AdvancedNameOptions {
  country: Country;
  mode: AdvancedNameMode;
  styleId: string;
  structureId: string;
  sex: NameSex;
  count: number;
}
export interface AdvancedNameEntry extends NameEntry {
  styleId: string;
  structureId: string;
  sex: "female" | "male";
  familyId: string;
  givenId: string;
  secondGivenId?: string;
  patronymicId?: string;
  bynameId?: string;
}
export const advancedNameCountries: readonly Country[] = ["cn", "jp", "gb", "fr", "de", "ru"];

/** 只排序展示副本，保留源数据、默认选择和抽样顺序。 */
export function chronologicalAdvancedStyles(data: AdvancedNameData, country: Country, mode: AdvancedNameMode): AdvancedNameStyle[] {
  return data.styles.filter((style) => style.country === country && style.mode === mode)
    .map((style, index) => ({ style, index }))
    .sort((a, b) => {
      if (!a.style.period) return b.style.period ? 1 : a.index - b.index;
      if (!b.style.period) return -1;
      return a.style.period.from - b.style.period.from || a.style.period.to - b.style.period.to || a.index - b.index;
    }).map(({ style }) => style);
}

export async function loadAdvancedNameData(): Promise<AdvancedNameData> {
  return (await import("./advanced-name-data.json")).default as AdvancedNameData;
}

export function generateAdvancedNames(
  data: AdvancedNameData,
  options: AdvancedNameOptions,
  random: () => number = Math.random,
): AdvancedNameEntry[] {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) {
    throw new Error("生成数量须为 1–50 的整数");
  }
  if (!["any", "male", "female"].includes(options.sex)) {
    throw new Error("请选择有效的名字性别倾向");
  }
  if (!["historical", "literary"].includes(options.mode)) {
    throw new Error("请选择有效的起名类型");
  }
  const style = data.styles.find((item) =>
    item.country === options.country && item.mode === options.mode && item.id === options.styleId);
  if (!style) throw new Error("请选择有效的起名风格");
  const structure = style.structures.find((item) => item.id === options.structureId);
  if (!structure) throw new Error("请选择当前风格支持的姓名结构");

  const needs = (part: string) => structure.originalTemplate.includes("{" + part + "}");
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
  const results = new Map<string, AdvancedNameEntry>();
  for (let attempt = 0; results.size < options.count && attempt < options.count * 40; attempt++) {
    const sex = options.sex === "any" ? (random() < 0.5 ? "female" : "male") : options.sex;
    const family = pick(style.families);
    const familyForm = family.forms[sex] ?? family.forms.generic!;
    const given = pick(style.given[sex]);
    const secondGiven = needs("secondGiven")
      ? pick(style.given[sex].filter((item) => item.original !== given.original)) : undefined;
    const patronymic = needs("patronymic") ? pick(style.patronymics!) : undefined;
    const byname = needs("byname") ? pick(style.bynames![sex]) : undefined;
    const parts: Record<string, NameEntry | undefined> = {
      family: familyForm, given, secondGiven, patronymic: patronymic?.[sex], byname,
    };
    const render = (template: string, language: "original" | "zh") =>
      template.replace(/\{([a-zA-Z]+)\}/g, (_match, token: string) => parts[token]![language]);
    const original = render(structure.originalTemplate, "original");
    if (!results.has(original)) {
      results.set(original, {
        original, zh: render(structure.zhTemplate, "zh"),
        styleId: style.id, structureId: structure.id, sex,
        familyId: family.id, givenId: given.id,
        ...(secondGiven ? { secondGivenId: secondGiven.id } : {}),
        ...(patronymic ? { patronymicId: patronymic.id } : {}),
        ...(byname ? { bynameId: byname.id } : {}),
      });
    }
  }
  return [...results.values()];
}
