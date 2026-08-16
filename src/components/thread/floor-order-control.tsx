"use client";

import { ArrowDownUp } from "lucide-react";
import type { FloorOrder } from "@/api/floor-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const orderItems = [
  { value: "OLDEST", label: "最早楼层在前" },
  { value: "NEWEST", label: "最新楼层在前" },
] as const satisfies ReadonlyArray<{ value: FloorOrder; label: string }>;

interface FloorOrderControlProps {
  order: FloorOrder;
  onOrderChange: (order: FloorOrder) => void;
}

export function FloorOrderControl({ order, onOrderChange }: FloorOrderControlProps) {
  return (
    <div
      role="group"
      aria-label="楼层阅读方式"
      className="mb-3 flex items-center justify-end gap-2"
    >
      <span className="inline-flex h-8 items-center gap-1.5 font-utility text-xs font-bold tracking-wide text-muted-foreground">
        <ArrowDownUp className="size-3.5" aria-hidden="true" />
        楼层排序
      </span>
      <Select
        items={orderItems}
        value={order}
        onValueChange={(value) => onOrderChange(value as FloorOrder)}
      >
        <SelectTrigger size="compact" aria-label="楼层排序" className="min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {orderItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
