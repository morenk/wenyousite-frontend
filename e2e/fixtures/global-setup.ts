import { requireIsolationRunner } from "../../scripts/e2e-isolation-gate.mjs";

export default async function setup() {
  await requireIsolationRunner();
}
