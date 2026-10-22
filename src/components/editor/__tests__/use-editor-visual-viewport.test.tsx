import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useEditorVisualViewport } from "../use-editor-visual-viewport";
function Probe(){const rect=useEditorVisualViewport(true);return <output>{JSON.stringify(rect)}</output>}
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
test("键盘可视高度与平移更新边界，监听在卸载时释放",()=>{
 vi.useFakeTimers();const viewport=Object.assign(new EventTarget(),{height:800,width:390,offsetTop:0,offsetLeft:0});vi.stubGlobal("visualViewport",viewport);
 const remove=vi.spyOn(viewport,"removeEventListener");const {unmount}=render(<Probe/>);
 expect(screen.getByRole("status")).toHaveTextContent('"height":800');
 act(()=>{viewport.height=350;viewport.offsetTop=100;viewport.dispatchEvent(new Event("resize"));viewport.dispatchEvent(new Event("scroll"));vi.advanceTimersByTime(20);});
 expect(screen.getByRole("status")).toHaveTextContent('"y":100');expect(screen.getByRole("status")).toHaveTextContent('"height":350');
 unmount();expect(remove).toHaveBeenCalledTimes(2);
});
test("无visualViewport的桌面保留窗口边界",()=>{vi.stubGlobal("visualViewport",undefined);render(<Probe/>);expect(screen.getByRole("status")).toHaveTextContent(`"height":${innerHeight}`);});
