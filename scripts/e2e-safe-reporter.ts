import { writeFileSync } from "node:fs";
import type { FullResult, Reporter, TestCase, TestError, TestResult } from "@playwright/test/reporter";
import { readAdminFixtures, readIsolation } from "./e2e-isolation-gate.mjs";

export function sanitize(text: string, env: NodeJS.ProcessEnv = process.env) {
  for (const key of ["E2E_EMAIL", "E2E_PASSWORD", "E2E_USERNAME"]) {
    if (env[key]) text = text.split(env[key]!).join("[redacted]");
  }
  if (env.E2E_ADMIN_FIXTURES) {
    try {
      for (const account of readAdminFixtures(readIsolation(env)).accounts) {
        text = text.split(account.email).join("[redacted-admin]").split(account.password).join("[redacted-admin]");
      }
    } catch { return "隔离管理账号身份不可核验，诊断已隐藏"; }
  }
  return text.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[redacted-token]")
    .replace(/(?:authorization|set-cookie|cookie):[^\n]*/gi, "[redacted-header]");
}

export default class SafeReporter implements Reporter {
  private results: { title: string; status: string; errors: string[] }[] = [];
  private errors: string[] = [];
  onError(error: TestError) { this.errors.push(sanitize(error.message ?? "测试启动失败")); }
  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push({ title: sanitize(test.titlePath().join(" / ")), status: result.status,
      errors: result.errors.map((error) => sanitize(error.stack ?? error.message ?? "测试失败")) });
    this.save("running");
  }
  onEnd(result: FullResult) {
    this.save(result.status);
  }
  private save(status: string) {
    writeFileSync(process.env.E2E_SAFE_REPORT!, JSON.stringify({ status, errors: this.errors, tests: this.results }), { mode: 0o600 });
  }
}
