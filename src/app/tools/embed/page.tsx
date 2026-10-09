import { Suspense } from "react";
import { Toolbox } from "@/components/tools/toolbox";
export default function EmbeddedToolsPage() { return <Suspense fallback={null}><Toolbox embedded /></Suspense>; }
