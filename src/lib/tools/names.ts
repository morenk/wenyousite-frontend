export const COUNTRIES = [
  { id: "cn", label: "中国" }, { id: "jp", label: "日本" }, { id: "gb", label: "英国" },
  { id: "de", label: "德国" }, { id: "fr", label: "法国" }, { id: "ru", label: "俄国" },
  { id: "us", label: "美国" }, { id: "it", label: "意大利" }, { id: "es", label: "西班牙" },
  { id: "kr", label: "韩国" }, { id: "br", label: "巴西" },
] as const;
export type Country = (typeof COUNTRIES)[number]["id"];
export type NameSex = "any" | "female" | "male";
export type NameStyle = "common" | "classical" | "fantasy";
interface NamesBySex { generic?: string[]; female?: string[]; male?: string[] }
export interface NameData { source: string; given: NamesBySex; family: NamesBySex }
const loaders: Record<Country, () => Promise<{ default: NameData }>> = {
  cn: () => import("./name-data/cn.json"), jp: () => import("./name-data/jp.json"),
  gb: () => import("./name-data/gb.json"), de: () => import("./name-data/de.json"),
  fr: () => import("./name-data/fr.json"), ru: () => import("./name-data/ru.json"),
  us: () => import("./name-data/us.json"), it: () => import("./name-data/it.json"),
  es: () => import("./name-data/es.json"), kr: () => import("./name-data/kr.json"),
  br: () => import("./name-data/br.json"),
};
export async function loadNameData(country: Country): Promise<NameData> {
  return (await loaders[country]()).default;
}
// 自编组合词库：仅作角色灵感，不引用典籍、不解释虚构寓意。
const inspiration = {
  classical: {
    starts: ["知", "怀", "清", "望", "行", "云", "归", "若", "听", "映", "照", "南", "书", "闻", "予", "见"],
    female: ["棠", "月", "笙", "宁", "蘅", "秋", "雪", "岚", "微", "音", "溪", "晚"],
    male: ["舟", "川", "衡", "砚", "远", "野", "庭", "淮", "尘", "洲", "岳", "澈"],
  },
  fantasy: {
    starts: ["星", "霜", "烬", "银", "夜", "澜", "镜", "曜", "空", "雾", "焰", "灵", "玄", "苍", "暮", "曦"],
    female: ["羽", "铃", "汐", "璃", "弦", "歌", "澪", "萤", "绫", "纱", "泠", "翎"],
    male: ["珩", "刃", "辰", "渊", "岚", "朔", "弦", "苍", "寂", "隐", "岐", "溯"],
  },
};
export interface NameOptions { country: Country; sex: NameSex; style: NameStyle; surname: string; count: number }
export function formatName(country: Country, given: string, family: string) {
  return ["cn", "jp", "kr"].includes(country) ? `${family}${given}` : `${given} ${family}`;
}
export function generateNames(data: NameData, options: NameOptions, random: () => number = Math.random): string[] {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) throw new Error("生成数量须为 1–50 的整数");
  if (options.surname.length > 40 || /[\r\n\t]/.test(options.surname)) throw new Error("固定姓氏须为 40 字以内的单行文字");
  if (options.style !== "common" && options.country !== "cn") throw new Error("古风与幻想风首版仅支持中文");
  const pick = (items: string[]) => items[Math.floor(random() * items.length)];
  const results = new Set<string>();
  for (let attempt = 0; results.size < options.count && attempt < options.count * 40; attempt++) {
    const sex = options.sex === "any" ? (random() < 0.5 ? "female" : "male") : options.sex;
    const family = options.surname.trim() || pick(data.family[sex] ?? data.family.generic!);
    const style = options.style === "common" ? null : inspiration[options.style];
    const given = style ? pick(style.starts) + pick(style[sex]) : pick(data.given[sex] ?? data.given.generic!);
    results.add(formatName(options.country, given, family));
  }
  return [...results];
}
