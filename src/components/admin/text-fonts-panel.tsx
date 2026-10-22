"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdminTextFonts } from "@/api/hooks/admin/use-admin-text-fonts";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AdminTable,
  AdminTableHead,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableCell,
  AdminTableActionCell,
  AdminTableActionHeader,
} from "./admin-table";
import { textFontGroup } from "@/components/editor/editor-text-font-options";
export function TextFontsPanel() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const query = useAdminTextFonts(cursors.at(-1));
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/station/text-fonts/new" className={buttonVariants()}>
          新建字体
        </Link>
      </div>
      {query.isError && (
        <div
          role="alert"
          className="flex items-center gap-3 text-sm text-destructive"
        >
          字体列表读取失败
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            重试
          </Button>
        </div>
      )}
      {query.isLoading ? (
        <p role="status">正在读取字体…</p>
      ) : (
        <AdminTable>
          <AdminTableHead>
            <AdminTableRow>
              {["名称", "语言", "状态", "排序", "当前版本"].map((label) => (
                <AdminTableHeader key={label}>{label}</AdminTableHeader>
              ))}
              <AdminTableActionHeader>操作</AdminTableActionHeader>
            </AdminTableRow>
          </AdminTableHead>
          <AdminTableBody>
            {query.data?.items.map((font) => (
              <AdminTableRow key={font.familyId}>
                <AdminTableCell>{font.name || "未命名字体"}</AdminTableCell>
                <AdminTableCell>
                  {textFontGroup(font.designLanguage)}
                </AdminTableCell>
                <AdminTableCell>
                  {!font.currentVersionId
                    ? "草稿"
                    : font.enabled
                      ? "启用"
                      : "停用"}
                </AdminTableCell>
                <AdminTableCell>{font.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  {font.currentVersionId?.slice(-8) ?? "尚未发布"}
                </AdminTableCell>
                <AdminTableActionCell>
                  <Link
                    href={`/station/text-fonts/${font.familyId}`}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "compact",
                    })}
                  >
                    管理
                  </Link>
                </AdminTableActionCell>
              </AdminTableRow>
            ))}
            {!query.isError && !query.data?.items.length && (
              <AdminTableRow>
                <AdminTableCell colSpan={6}>暂无字体</AdminTableCell>
              </AdminTableRow>
            )}
          </AdminTableBody>
        </AdminTable>
      )}
      <div className="flex items-center justify-between text-sm">
        <span>
          第 {cursors.length} 页 · {query.data?.items.length ?? 0} 条
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={cursors.length === 1 || query.isFetching}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            disabled={!query.data?.nextAfter || query.isFetching}
            onClick={() =>
              setCursors((previous) => [...previous, query.data!.nextAfter!])
            }
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
