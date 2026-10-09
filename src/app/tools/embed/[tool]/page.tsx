import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Toolbox } from "@/components/tools/toolbox";
import { isToolId } from "@/lib/tools/catalog";
export default async function EmbeddedToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isToolId(tool)) notFound();
  return <Suspense fallback={null}><Toolbox selected={tool} embedded /></Suspense>;
}
