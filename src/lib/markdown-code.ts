/** 用等长空白遮蔽 Markdown 围栏代码和成对行内代码，保留源位置供节点解析器使用。 */
export function maskMarkdownCode(content: string): string {
  const lines = content.split("\n");
  let fence: { marker: "`" | "~"; length: number } | null = null;

  return lines.map((line) => {
    const fenceToken = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})[\t ]*$/u.exec(line)?.[1];
      if (closing?.[0] === fence.marker && closing.length >= fence.length) fence = null;
      return " ".repeat(line.length);
    }
    if (fenceToken) {
      fence = { marker: fenceToken[0] as "`" | "~", length: fenceToken.length };
      return " ".repeat(line.length);
    }

    const chars = [...line];
    let index = 0;
    while (index < line.length) {
      if (line[index] !== "`") {
        index++;
        continue;
      }
      let runLength = 1;
      while (line[index + runLength] === "`") runLength++;
      const delimiter = "`".repeat(runLength);
      const closingIndex = line.indexOf(delimiter, index + runLength);
      if (closingIndex < 0) {
        index += runLength;
        continue;
      }
      const end = closingIndex + runLength;
      for (let cursor = index; cursor < end; cursor++) chars[cursor] = " ";
      index = end;
    }
    return chars.join("");
  }).join("\n");
}

/** 奇数个连续反斜杠表示当前位置的 Markdown 标记被转义。 */
export function isMarkdownEscaped(content: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor--) slashes++;
  return slashes % 2 === 1;
}
