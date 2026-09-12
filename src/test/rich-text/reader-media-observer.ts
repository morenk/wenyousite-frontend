import { vi } from "vitest";
import { createElement } from "react";
import type { Components, Options } from "react-markdown";

// 观察真实 ReactMarkdown 传给生产图片组件的属性；随后仍调用原组件渲染。
// 贴纸身份在阅读解析阶段存在，但按产品规则不暴露到可复制的 DOM。
const readerImages = vi.hoisted(() => [] as Array<{ src: string; alt: string; title: string }>);
vi.mock("react-markdown", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-markdown")>();
  return { ...actual, default: (props: Options) => {
    const OriginalImage = props.components?.img;
    const img: Components["img"] = (imageProps) => {
      readerImages.push({ src: String(imageProps.src ?? ""), alt: imageProps.alt ?? "", title: imageProps.title ?? "" });
      return createElement(OriginalImage ?? "img", imageProps);
    };
    return createElement(actual.default, { ...props, components: { ...props.components, img } });
  } };
});

export function observedReaderImages() { return readerImages; }
