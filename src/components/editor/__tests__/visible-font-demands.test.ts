import {afterEach,expect,test,vi}from"vitest";
import {observeFontDemands}from"../visible-font-demands";
afterEach(()=>{document.body.replaceChildren();vi.useRealTimers();vi.unstubAllGlobals();document.getSelection()?.removeAllRanges()});
function setup(){
 let notify:IntersectionObserverCallback=()=>{};vi.stubGlobal("IntersectionObserver",class{constructor(callback:IntersectionObserverCallback){notify=callback}observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn()});
 const root=document.createElement("div");root.innerHTML='<span data-wenyou-font-v1="great-vibes">ABC</span>';document.body.append(root);const element=root.firstElementChild!;
 const released=vi.fn(),request=vi.fn(()=>released),apply=vi.fn(),observer=observeFontDemands(root,request,apply);
 const visible=(value:boolean)=>notify([{target:element,isIntersecting:value}as IntersectionObserverEntry],{}as IntersectionObserver);
 return{root,element,request,released,apply,observer,visible};
}
test("只为可见内容建租约，离屏防抖取消后再出现可重新请求同key",async()=>{
 vi.useFakeTimers();const f=setup();expect(f.request).not.toHaveBeenCalled();f.visible(true);expect(f.request).toHaveBeenCalledTimes(1);
 f.visible(false);await vi.advanceTimersByTimeAsync(100);f.visible(true);await vi.advanceTimersByTimeAsync(300);expect(f.released).not.toHaveBeenCalled();
 f.visible(false);await vi.advanceTimersByTimeAsync(200);expect(f.released).toHaveBeenCalledTimes(1);f.visible(true);expect(f.request).toHaveBeenCalledTimes(2);f.observer.disconnect();expect(f.released).toHaveBeenCalledTimes(2);
});
test("离屏的编辑选区保持租约，选区移出后释放；旧代次晚到结果不写DOM",async()=>{
 vi.useFakeTimers();const f=setup();f.visible(true);const emit=(f.request.mock.calls[0]as unknown as[string,string,(r:unknown)=>void])[2];
 const range=document.createRange();range.setStart(f.element.firstChild!,1);range.collapse(true);document.getSelection()!.addRange(range);f.visible(false);await vi.advanceTimersByTimeAsync(500);expect(f.released).not.toHaveBeenCalled();
 document.getSelection()!.removeAllRanges();document.dispatchEvent(new Event("selectionchange"));await vi.advanceTimersByTimeAsync(200);expect(f.released).toHaveBeenCalledTimes(1);
 emit({family:"old",status:"ready"});expect(f.apply).not.toHaveBeenCalled();f.observer.disconnect();
});
test("目录刷新重建可见租约，正文删除清理所有引用",async()=>{
 const f=setup();f.visible(true);f.observer.refresh();expect(f.released).toHaveBeenCalledTimes(1);expect(f.request).toHaveBeenCalledTimes(2);
 f.element.remove();await vi.waitFor(()=>expect(f.released).toHaveBeenCalledTimes(2));f.observer.disconnect();
});
test("后台立即释放包括选区在内的需求，回前台恢复一次且不改变选区",()=>{
 const f=setup();f.visible(true);
 const range=document.createRange();range.setStart(f.element.firstChild!,1);range.setEnd(f.element.firstChild!,2);document.getSelection()!.addRange(range);
 const visibility=vi.spyOn(document,"visibilityState","get");visibility.mockReturnValue("hidden");document.dispatchEvent(new Event("visibilitychange"));
 expect(f.released).toHaveBeenCalledTimes(1);expect(document.getSelection()?.toString()).toBe("B");
 f.visible(true);f.observer.refresh();expect(f.request).toHaveBeenCalledTimes(1);
 visibility.mockReturnValue("visible");document.dispatchEvent(new Event("visibilitychange"));document.dispatchEvent(new Event("visibilitychange"));
 expect(f.request).toHaveBeenCalledTimes(2);expect(document.getSelection()?.toString()).toBe("B");f.observer.disconnect();visibility.mockRestore();
});
test("后台首次进入不请求，前台恢复可见需求",()=>{
 const visibility=vi.spyOn(document,"visibilityState","get").mockReturnValue("hidden");const f=setup();f.visible(true);expect(f.request).not.toHaveBeenCalled();
 visibility.mockReturnValue("visible");document.dispatchEvent(new Event("visibilitychange"));expect(f.request).toHaveBeenCalledTimes(1);f.observer.disconnect();visibility.mockRestore();
});
