import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EditorFontDownloadProgress, type EditorFontDownloadHandle } from "../editor-font-download-progress";
import type { FontDownloadSnapshot } from "@/lib/dynamic-text-font-runtime";
const env=vi.hoisted(()=>({listen:vi.fn(),release:vi.fn()}));
vi.mock("@/lib/dynamic-text-font-runtime",()=>({dynamicTextFontRuntime:()=>({subscribeDownload:env.listen})}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
function setup(){
 vi.useFakeTimers();let emit!:(value:FontDownloadSnapshot)=>void;
 env.listen.mockImplementation((_id,_scope,listener)=>{emit=listener;return env.release;});
 const ref=createRef<EditorFontDownloadHandle>(),scope=Symbol("editor");const view=render(<EditorFontDownloadProgress ref={ref} scope={scope}/>);
 act(()=>ref.current!.start("selected-version","样张字体"));
 const report=(value:Partial<FontDownloadSnapshot>)=>act(()=>emit({status:"loading",started:true,receivedBytes:10,totalBytes:100,phase:"downloading",...value}));
 const advance=(time:number)=>act(()=>vi.advanceTimersByTime(time));
 return {ref,scope,report,advance,...view};
}
test("仅主动应用订阅本编辑scope，空需求与缓存命中不闪",()=>{
 const f=setup();expect(env.listen).toHaveBeenCalledWith("selected-version",f.scope,expect.any(Function));
 f.advance(500);expect(screen.queryByRole("progressbar")).toBeNull();
 f.report({status:"ready",started:false});f.advance(500);expect(screen.queryByRole("status")).toBeNull();expect(env.release).toHaveBeenCalled();
});
test("真实字节节流，未知总量不伪百分比，校验注册前只显示正在应用",()=>{
 const f=setup();f.report({totalBytes:null,phase:"preparing"});f.advance(249);expect(screen.queryByRole("progressbar")).toBeNull();
 f.advance(1);expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");expect(screen.getByText("10 B 已接收")).toBeInTheDocument();
 for(let i=11;i<=30;i++)f.report({receivedBytes:i});
 expect(screen.getByRole("status")).toHaveTextContent("准备字体");f.advance(100);expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow","30");
 f.report({receivedBytes:100,phase:"applying"});f.advance(100);expect(screen.getByRole("status")).toHaveTextContent("正在应用字体");expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
 f.report({status:"ready",receivedBytes:100,phase:"applying"});expect(screen.queryByRole("status")).toBeNull();
});
test("失败不显示永久旋转，自动恢复或主动收起不影响输入且迟到事件无效",()=>{
 const f=setup();f.report({status:"fallback"});f.advance(250);expect(screen.getByRole("status")).toHaveTextContent("暂用系统字体");expect(screen.queryByRole("progressbar")).toBeNull();
 f.report({status:"loading",receivedBytes:20});f.advance(100);expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow","20");
 fireEvent.click(screen.getByRole("button",{name:"收起字体下载状态"}));f.report({receivedBytes:50});f.advance(300);expect(screen.queryByRole("status")).toBeNull();
 f.unmount();expect(vi.getTimerCount()).toBe(0);
});


test("当前scope有实际需求但元数据慢时延迟显示准备态，不伪造分母",()=>{
 const f=setup();f.report({started:false,totalBytes:null,receivedBytes:0,phase:"preparing"});f.advance(249);expect(screen.queryByRole("status")).toBeNull();
 f.advance(1);expect(screen.getByRole("status")).toHaveTextContent("准备字体");expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");expect(screen.queryByText(/0 B/)).toBeNull();
});
