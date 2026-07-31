/** SubthreadFloors：沙盒内子贴楼层列表（加载全部楼层，含编辑/删除/添加操作） */

"use client";

import { Loader2, Pencil, Trash2, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useFloors, type PostData } from "@/api/hooks/use-floors";

interface SubthreadFloorsProps {
  subthreadId: string;
  canManage?: boolean;
  onEditFloor: (floor: PostData) => void;
  onDeleteFloor: (floor: PostData) => void;
  onAddFloor: () => void;
}

export function SubthreadFloors({
  subthreadId,
  canManage = false,
  onEditFloor,
  onDeleteFloor,
  onAddFloor,
}: SubthreadFloorsProps) {
  const { data, isLoading, isError } = useFloors(subthreadId);
  const floors = data?.pages.flatMap((page) => page.data) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载楼层…
      </div>
    );
  }

  if (isError) {
    return <p className="py-4 text-sm text-destructive">楼层加载失败</p>;
  }

  return (
    <div className="space-y-2">
      {floors.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">该子贴暂无楼层</p>
      ) : (
        floors.map((floor) => {
          const isBodyPost =
            floor.floorNumber === 1 && floor.parentPostId === null;
          return (
            <div
              key={floor.id}
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  #{floor.floorNumber ?? "-"}
                </span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditFloor(floor)}
                      title="编辑楼层"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!isBodyPost && (
                      <button
                        type="button"
                        onClick={() => onDeleteFloor(floor)}
                        title="删除楼层"
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {floor.content}
                </ReactMarkdown>
              </div>
            </div>
          );
        })
      )}

      {canManage && (
        <button
          type="button"
          onClick={onAddFloor}
          className="w-full rounded-lg border border-dashed border-border bg-muted/30 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Plus className="mr-1.5 inline h-3.5 w-3.5" />
          添加楼层
        </button>
      )}
    </div>
  );
}
