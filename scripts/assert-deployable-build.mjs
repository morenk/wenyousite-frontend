import { assertDeployableBuild } from "./e2e-candidate-policy.mjs";

assertDeployableBuild(process.argv[2] ?? ".next");
