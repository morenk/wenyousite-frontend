import { expect, type Page } from "@playwright/test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  privateJSON,
  readAdminFixtures,
  requireIsolationRunner,
} from "../../scripts/e2e-isolation-gate.mjs";
export async function loginIsolatedAdmin(page: Page, path: string) {
  const run = await requireIsolationRunner(),
    fixture = readAdminFixtures(run),
    account = fixture.accounts.find(
      (item: { role: string }) => item.role === "ADMIN",
    )!;
  const before = new Set(readdirSync(fixture.mailboxPath));
  try {
    await page.goto(path);
    await page.getByLabel("账号", { exact: true }).fill(account.email);
    await page.getByLabel("密码", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "继续", exact: true }).click();
    await page.getByLabel("6 位验证码").waitFor();
    const code = await readCode(fixture.mailboxPath, account.email, before);
    await page.getByLabel("6 位验证码").fill(code);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.getByRole("navigation", { name: "管理功能" }).waitFor();
  } catch {
    throw new Error("本轮管理员登录失败（敏感诊断已隐藏）");
  }
}
async function readCode(mailbox: string, email: string, before: Set<string>) {
  let code: string | undefined;
  await expect
    .poll(() => {
      for (const name of readdirSync(mailbox).filter(
        (name) => !before.has(name),
      )) {
        const mail = privateJSON(join(mailbox, name));
        if (mail.to === email)
          code = String(mail.html).match(/>([0-9]{6})</)?.[1];
      }
      return Boolean(code);
    })
    .toBe(true);
  return code!;
}
export async function elevateIsolatedAdmin(page: Page) {
  const run = await requireIsolationRunner(),
    fixture = readAdminFixtures(run),
    account = fixture.accounts.find(
      (item: { role: string }) => item.role === "ADMIN",
    )!,
    before = new Set(readdirSync(fixture.mailboxPath));
  if (
    await page
      .getByRole("button", { name: "发送邮箱验证码", exact: true })
      .isVisible()
  ) {
    try {
      await page
        .getByRole("button", { name: "发送邮箱验证码", exact: true })
        .click();
      await page
        .getByLabel("邮箱验证码")
        .fill(await readCode(fixture.mailboxPath, account.email, before));
      await page
        .getByRole("button", { name: "确认验证码", exact: true })
        .click();
    } catch {
      throw new Error("本轮管理员提权失败（敏感诊断已隐藏）");
    }
  }
}
