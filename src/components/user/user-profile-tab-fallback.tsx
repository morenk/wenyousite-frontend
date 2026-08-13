import { NavigationProgress } from "@/components/layout/navigation-progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Tab 路由尚未就绪时只替换内容区，资料头部与导航保持可见。 */
export function UserProfileTabFallback() {
  return (
    <div
      role="status"
      aria-label="资料内容加载中"
      data-slot="profile-tab-fallback"
      className="min-h-72"
    >
      <NavigationProgress />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl border border-border p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
