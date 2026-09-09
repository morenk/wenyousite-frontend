import { readFileSync } from "node:fs";
import path from "node:path";

export function imageFixture(name: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(path.join(process.cwd(), "src/lib/__tests__/fixtures/images", name)));
}
