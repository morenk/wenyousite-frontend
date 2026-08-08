/** 主题帖标签输入组件：支持自动补全、回车添加、删除 */

"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTags } from "@/api/hooks/use-tags";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  max = 5,
  disabled,
  className,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: candidates, isLoading } = useTags(input);

  function addTag(name: string) {
    const trimmed = name.trim().replace(/\s+/g, "");
    if (!trimmed || value.includes(trimmed)) return;
    if (value.length >= max) return;
    onChange([...value, trimmed]);
    setInput("");
  }

  function removeTag(name: string) {
    onChange(value.filter((t) => t !== name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 transition-colors",
          focused && "border-ring ring-3 ring-ring/50",
          disabled && "opacity-60 pointer-events-none",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-brand-strong"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
              className="rounded-sm hover:bg-primary/20"
              aria-label={`删除标签 ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          placeholder={value.length < max ? "输入标签，按回车添加" : "标签已满"}
          disabled={disabled || value.length >= max}
          className="h-6 min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {focused && input.trim() && value.length < max && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-1 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-2 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              搜索中…
            </div>
          ) : (
            <ul>
              {(candidates ?? [])
                .filter((c) => !value.includes(c.name))
                .slice(0, 5)
                .map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => addTag(candidate.name)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {candidate.name}
                    </button>
                  </li>
                ))}
              {candidates?.length === 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => addTag(input)}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    按回车创建 “{input.trim()}”
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        最多 {max} 个标签，支持中文、字母、数字、下划线、#
      </p>
    </div>
  );
}
