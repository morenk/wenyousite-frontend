import inspirationData from "./name-inspiration.json";

export const COUNTRIES = [
  { id: "cn", label: "中国" }, { id: "jp", label: "日本" }, { id: "gb", label: "英国" },
  { id: "de", label: "德国" }, { id: "fr", label: "法国" }, { id: "ru", label: "俄国" },
  { id: "us", label: "美国" }, { id: "it", label: "意大利" }, { id: "es", label: "西班牙" },
  { id: "kr", label: "韩国" }, { id: "br", label: "巴西" },
] as const;
export type Country = (typeof COUNTRIES)[number]["id"];
export type NameSex = "any" | "female" | "male";
export type NameStyle = "common" | "classical" | "fantasy";
export interface NameEntry { original: string; zh: string }
interface NamesBySex { generic?: (string | NameEntry)[]; female?: (string | NameEntry)[]; male?: (string | NameEntry)[] }
export interface NameData { source: string; given: NamesBySex; family: NamesBySex }
export interface NameOptions { country: Country; sex: NameSex; style: NameStyle; surname: string; surnameZh?: string; count: number }

export async function loadNameData(country: Country): Promise<NameData> {
  if (country === "cn") return (await import("./name-data/cn.json")).default;
  const data = (await import("./bilingual-name-data.json")).default;
  return { source: `wenyou-bilingual-names@${data.dataVersion}/${country}`, ...data.countries[country] };
}
const entry = (value: string | NameEntry): NameEntry => typeof value === "string" ? { original: value, zh: value } : value;
const isChineseSurname = (value: string) => /^[\p{Script=Han}]+$/u.test(value);
export function findSurname(data: NameData, surname: string): NameEntry | undefined {
  const lookup = surname.trim().toLowerCase();
  return Object.values(data.family).flat().map(entry).find((item) => item.original.toLowerCase() === lookup);
}
export function needsSurnameTranslation(data: NameData, country: Country, surname: string): boolean {
  return country !== "cn" && !!surname.trim() && !isChineseSurname(surname.trim()) && !findSurname(data, surname);
}
export function formatName(country: Country, given: string, family: string, chinese = false) {
  return ["cn", "jp", "kr"].includes(country) ? `${family}${given}` : `${given}${chinese ? "·" : " "}${family}`;
}
export function generateBilingualNames(data: NameData, options: NameOptions, random: () => number = Math.random): NameEntry[] {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) throw new Error("生成数量须为 1–50 的整数");
  for (const surname of [options.surname, options.surnameZh ?? ""]) {
    if (surname.length > 40 || /[\r\n\t]/.test(surname)) throw new Error("固定姓氏须为 40 字以内的单行文字");
  }
  if (options.style !== "common" && options.country !== "cn") throw new Error("古风与幻想风首版仅支持中文");
  const surname = options.surname.trim();
  const known = findSurname(data, surname);
  const surnameZh = known?.zh || (isChineseSurname(surname) ? surname : options.surnameZh?.trim());
  if (needsSurnameTranslation(data, options.country, surname) && !surnameZh) throw new Error("请填写姓氏中文写法");
  if (needsSurnameTranslation(data, options.country, surname) && (!/^[\p{Script=Han}·・\- ]+$/u.test(surnameZh!) || !/\p{Script=Han}/u.test(surnameZh!))) throw new Error("姓氏中文写法须使用汉字");
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  const results = new Map<string, NameEntry>();
  for (let attempt = 0; results.size < options.count && attempt < options.count * 40; attempt++) {
    const sex = options.sex === "any" ? (random() < 0.5 ? "female" : "male") : options.sex;
    const family = surname ? { original: surname, zh: options.country === "cn" ? surname : surnameZh! }
      : entry(pick(data.family[sex] ?? data.family.generic!));
    const style = options.style === "common" ? null : inspirationData.styles[options.style];
    const given = style ? entry(pick(style.starts) + pick(style[sex])) : entry(pick(data.given[sex] ?? data.given.generic!));
    const original = formatName(options.country, given.original, family.original);
    results.set(original, { original, zh: formatName(options.country, given.zh, family.zh, true) });
  }
  return [...results.values()];
}
export function generateNames(data: NameData, options: NameOptions, random: () => number = Math.random): string[] {
  return generateBilingualNames(data, options, random).map((item) => item.original);
}
