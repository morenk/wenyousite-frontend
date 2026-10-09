"use client";
import { Button } from "@/components/ui/button";
export default function ToolError({ reset }: { reset: () => void }) { return <div className="grid gap-4 p-6"><p role="alert">工具暂时无法加载，请检查连接后重试。</p><Button onClick={reset} className="justify-self-start">重试</Button></div>; }
