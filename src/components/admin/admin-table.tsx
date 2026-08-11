import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminTable({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full border-separate border-spacing-0 text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function AdminTableHead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-muted text-foreground", className)} {...props} />;
}

export function AdminTableHeader({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-y border-border px-4 py-2.5 font-utility text-[0.6875rem] font-bold tracking-[0.04em] whitespace-nowrap first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-border bg-card", className)} {...props} />;
}

export function AdminTableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "transition-colors duration-[var(--motion-fast)] hover:bg-muted/70 data-[selected=true]:bg-accent/60",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", className)}
      {...props}
    />
  );
}

export function AdminTableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <AdminTableRow>
      <AdminTableCell colSpan={colSpan} className="h-28 text-center text-muted-foreground">
        {children}
      </AdminTableCell>
    </AdminTableRow>
  );
}
