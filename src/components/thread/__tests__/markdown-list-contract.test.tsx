import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MarkdownContent } from "@/components/thread/markdown-content";

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "contracts/markdown-editor-list-v1-fixtures.json"), "utf8")) as {cases:Array<{id:string;markdown:string;canonical:string;items:Array<{type:string;depth:number;parent:number|null;start:number|null;text:string;empty:boolean}>}>};
afterEach(cleanup);

test.each(fixture.cases)("$id 真实阅读组件保持类型、父子、编号和空项", item => {
 for (const content of [item.markdown,item.canonical]) {
  const {container,unmount}=render(<MarkdownContent content={content}/>);
  const lis=Array.from(container.querySelectorAll("li"));
  const actual=lis.map(li=>{
   const list=li.parentElement!;
   const parent=list.closest("li");
   let depth=0;
   let cursor=parent;
   while(cursor){depth++;cursor=cursor.parentElement!.closest("li");}
   const clone=li.cloneNode(true) as HTMLElement;
   clone.querySelectorAll("ul,ol").forEach(el=>el.remove());
   clone.querySelectorAll("br").forEach(el=>{
    // React Markdown 在软换行 br 后附加格式化 LF；浏览器不会再产生第二个可见换行。
    if (el.nextSibling?.nodeType === 3 && el.nextSibling.textContent?.startsWith("\n")) el.nextSibling.textContent = el.nextSibling.textContent.slice(1);
    el.replaceWith("\n");
   });
   const blocks=Array.from(clone.querySelectorAll(":scope > p,:scope > h2,:scope > h3"));
   const text=(blocks.length ? blocks.map(b=>b.textContent).join("\n") : clone.textContent ?? "").trim();
   return {type:list.tagName==="OL"?"ordered":"bullet",depth,parent:parent?lis.indexOf(parent):null,start:list.tagName==="OL"?Number(list.getAttribute("start")??1):null,text,empty:text===""};
  });
  expect(actual).toEqual(item.items.map(({type,depth,parent,start,text,empty})=>({type,depth,parent,start,text,empty})));
  unmount();
 }
});
