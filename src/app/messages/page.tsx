import { MessageCircle } from "lucide-react";

export default function MessagesPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
      <MessageCircle className="h-10 w-10 opacity-40" />
      <div>
        <p className="text-sm font-medium text-foreground">选择一条私聊</p>
        <p className="mt-1 text-xs">你也可以从用户主页发起新的私聊</p>
      </div>
    </div>
  );
}
