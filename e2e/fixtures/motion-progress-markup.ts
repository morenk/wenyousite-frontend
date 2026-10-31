import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Progress } from "../../src/components/ui/progress";

process.stdout.write(renderToStaticMarkup(createElement("main", { style: { padding: 48, maxWidth: 640 } },
  createElement("h1", null, "上传图片"), createElement(Progress, { value: 25, "aria-label": "正在上传图片" }),
  createElement("p", null, "正在处理图片"), createElement(Progress, { value: null, "aria-label": "正在处理图片" }))));
