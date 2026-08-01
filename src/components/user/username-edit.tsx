/** 独立用户名修改：默认只读展示，点「修改用户名」才进入编辑态，未改动不提交 */

"use client";

import { useState } from "react";
import { Loader2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/api/hooks/use-update-profile";
import { usernameSchema } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UsernameEditProps {
  currentUsername: string;
}

export function UsernameEdit({ currentUsername }: UsernameEditProps) {
  const { user, accessToken, setAuth } = useAuth();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentUsername);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const startEdit = () => {
    setValue(currentUsername);
    setFieldError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFieldError(null);
  };

  const handleSave = async () => {
    const next = value.trim();
    // 未修改用户名：不发请求，直接收起
    if (next === currentUsername) {
      setEditing(false);
      setFieldError(null);
      return;
    }

    const parsed = usernameSchema.safeParse({ username: next });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "用户名格式不正确");
      return;
    }

    try {
      await updateProfile.mutateAsync({ username: next });
      // 同步更新导航栏等 localStorage 中的用户信息
      if (user && accessToken) {
        setAuth({ ...user, username: next }, accessToken);
      }
      toast.success("用户名已更新");
      setEditing(false);
      setFieldError(null);
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e.code === 409) {
        setFieldError("用户名已被占用");
      } else if (e.code === 42900) {
        toast.error("操作太频繁，请稍后再试");
      } else {
        setFieldError(e.message || "修改失败，请稍后重试");
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">用户名</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {editing ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="输入新用户名"
            />
            {fieldError && (
              <p className="text-xs text-destructive">{fieldError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              2-24 位，字母/数字/中文。修改后 7 天内不可再次修改。
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                disabled={updateProfile.isPending}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!value.trim() || updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3.5 w-3.5" />
                )}
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground">
              {currentUsername}
            </p>
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              修改用户名
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
