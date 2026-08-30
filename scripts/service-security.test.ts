import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const servicePath = resolve(process.cwd(), "ops/wenyousite-frontend.service");
const service = readFileSync(servicePath, "utf8");

describe("前端 systemd 安全边界", () => {
  test("使用专用非 root 用户和固定 Node runtime", () => {
    expect(service).toContain("User=wenyousite-frontend");
    expect(service).toContain("Group=wenyousite-frontend");
    expect(service).toContain("Environment=WENYOU_NODE_BINARY=/usr/local/lib/wenyousite/node");
    expect(service).not.toContain("User=root");
    expect(service).not.toContain("Group=root");
  });

  test("限制宿主机、设备、能力和网络访问面", () => {
    expect(service).toContain("ProtectHome=true");
    expect(service).toContain("ProtectSystem=strict");
    expect(service).toContain("PrivateDevices=true");
    expect(service).toContain("CapabilityBoundingSet=");
    expect(service).toContain("RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX");
  });
});
