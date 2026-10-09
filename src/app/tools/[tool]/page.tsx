import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Toolbox } from "@/components/tools/toolbox";
import { isToolId } from "@/lib/tools/catalog";
export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isToolId(tool)) notFound();
  return <Suspense fallback={null}><Toolbox selected={tool} /></Suspense>;
}
