import type { CursorMeta } from "@/api/admin-types";

export interface Envelope<T> {
  data: T;
  meta?: CursorMeta;
}

export function envelope<T>(value: unknown): Envelope<T> {
  return value as Envelope<T>;
}
