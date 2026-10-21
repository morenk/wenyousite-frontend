import { normalizeTextFont, TEXT_FONT_ATTRIBUTE } from "@/lib/markdown-text-font";
import type { FontSessionResult } from "@/lib/thread-font-session";
interface Entry { visible: boolean; key?: string; release?: () => void; timer?: ReturnType<typeof setTimeout>; generation: number }
/** 可见性控制下载租约；短暂离屏不抖动，选区/光标所用分片保持引用。 */
export function observeFontDemands(root: HTMLElement, request: (fontId: string, text: string, emit: (result: FontSessionResult) => void) => () => void, apply: (element: Element, fontId: string, result: FontSessionResult) => void, releaseDelayMs = 200) {
  const entries = new Map<Element, Entry>();
  let alive = true;
  const selected = (element: Element) => {
    const selection = document.getSelection();
    if (!selection?.rangeCount) return false;
    if (element.contains(selection.anchorNode) || element.contains(selection.focusNode)) return true;
    if (selection.isCollapsed) return false;
    for (let i=0;i<selection.rangeCount;i++) { try { if(selection.getRangeAt(i).intersectsNode(element))return true; } catch { /* 已移除的节点不保留租约。 */ } }
    return false;
  };
  const release = (entry: Entry) => {
    clearTimeout(entry.timer);entry.timer=undefined;entry.generation++;entry.release?.();entry.release=undefined;entry.key=undefined;
  };
  const update = (element: Element, entry: Entry, force = false) => {
    if (!root.contains(element)) {release(entry);return;}
    if (!entry.visible && !(entry.release && selected(element))) {
      if(entry.release&&!entry.timer)entry.timer=setTimeout(()=>{entry.timer=undefined;if(!entry.visible&&!selected(element))release(entry)},releaseDelayMs);
      return;
    }
    clearTimeout(entry.timer);entry.timer=undefined;
    const fontId=normalizeTextFont(element.getAttribute(TEXT_FONT_ATTRIBUTE)),text=element.textContent??"";
    if(!fontId||!text){release(entry);return;}
    const key=fontId+":"+text;
    if(!force&&entry.release&&entry.key===key)return;
    release(entry);entry.key=key;const generation=entry.generation;
    entry.release=request(fontId,text,result=>{
      if(alive&&entry.generation===generation&&root.contains(element)&&entry.key===key)apply(element,fontId,result);
    });
  };
  const observer=typeof IntersectionObserver==="undefined"?null:new IntersectionObserver(records=>{
    for(const record of records){const entry=entries.get(record.target);if(entry){entry.visible=record.isIntersecting;update(record.target,entry)}}
  },{rootMargin:"0px"});
  const scan=()=>{
    for(const element of root.querySelectorAll("["+TEXT_FONT_ATTRIBUTE+"]")){
      let entry=entries.get(element);
      if(!entry){entry={visible:!observer,generation:0};entries.set(element,entry);observer?.observe(element)}
      update(element,entry);
    }
    for(const[element,entry]of entries)if(!root.contains(element)||!element.hasAttribute(TEXT_FONT_ATTRIBUTE)){release(entry);observer?.unobserve(element);entries.delete(element)}
  };
  const selectionChanged=()=>{for(const[element,entry]of entries)update(element,entry)};
  const mutations=new MutationObserver(scan);mutations.observe(root,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:[TEXT_FONT_ATTRIBUTE]});
  document.addEventListener("selectionchange",selectionChanged);scan();
  return {
    refresh:()=>{for(const[element,entry]of entries)update(element,entry,true)},
    disconnect:()=>{alive=false;observer?.disconnect();mutations.disconnect();document.removeEventListener("selectionchange",selectionChanged);for(const entry of entries.values())release(entry);entries.clear()},
  };
}
