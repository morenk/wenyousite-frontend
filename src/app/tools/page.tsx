import { Suspense } from "react";
import { Toolbox } from "@/components/tools/toolbox";
export const metadata = { title: "温油工具箱" };
export default function ToolsPage() { return <Suspense fallback={null}><Toolbox /></Suspense>; }
