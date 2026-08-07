/** Dart/Flutter 生成器兼容门禁：拒绝匿名操作、内联成功响应和 OpenAPI 3.1 语法。 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contractPath = resolve(process.cwd(), "contracts/openapi.json");
const spec = JSON.parse(readFileSync(contractPath, "utf8"));
const failures = [];
const operationIds = new Set();
const methods = ["get", "post", "put", "patch", "delete"];
const requestIdHeaderRef = "#/components/headers/XRequestId";
const contractVersionHeaderRef = "#/components/headers/XApiContractVersion";
const retryAfterHeaderRef = "#/components/headers/RetryAfter";

function usesHeader(response, name, reference) {
  return response?.headers?.[name]?.$ref === reference;
}

if (!/^3\.0\./.test(spec.openapi ?? "")) {
  failures.push(`需要 OpenAPI 3.0.x，实际为 ${spec.openapi ?? "missing"}`);
}
if (!Array.isArray(spec.servers) || spec.servers.length === 0) {
  failures.push("缺少 servers，生成客户端无法选择基础地址");
}

for (const [apiPath, pathItem] of Object.entries(spec.paths ?? {})) {
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation) continue;
    const label = `${method.toUpperCase()} ${apiPath}`;
    if (!/^[a-z][A-Za-z0-9]*$/.test(operation.operationId ?? "")) {
      failures.push(`${label} 缺少稳定 lowerCamel operationId`);
    } else if (operationIds.has(operation.operationId)) {
      failures.push(`${label} 重复 operationId ${operation.operationId}`);
    } else {
      operationIds.add(operation.operationId);
    }
    for (const [status, response] of Object.entries(operation.responses ?? {})) {
      if (!usesHeader(response, "X-Request-ID", requestIdHeaderRef)) {
        failures.push(`${label} ${status} 缺少 X-Request-ID 响应头`);
      }
      if (!usesHeader(response, "X-API-Contract-Version", contractVersionHeaderRef)) {
        failures.push(`${label} ${status} 缺少 X-API-Contract-Version 响应头`);
      }
      if (status === "429" && !usesHeader(response, "Retry-After", retryAfterHeaderRef)) {
        failures.push(`${label} 429 缺少 Retry-After 响应头`);
      }
      if (!/^2\d\d$/.test(status) || status === "204" || status === "205") continue;
      const schema = response?.content?.["application/json"]?.schema;
      if (!schema?.$ref?.startsWith("#/components/schemas/")) {
        failures.push(`${label} ${status} 必须引用具名响应 component`);
      }
    }
    for (const parameter of operation.parameters ?? []) {
      if (parameter.in === "query" && Object.keys(parameter.schema ?? {}).length === 0) {
        failures.push(`${label} 查询参数 ${parameter.name} 的 schema 为空`);
      }
    }
  }
}

for (const [apiPath, method] of [
  ["/api/v1/auth/login", "post"],
  ["/api/v1/auth/register/verify-and-complete", "post"],
]) {
  const operation = spec.paths?.[apiPath]?.[method];
  const platformHeader = operation?.parameters?.find(
    (parameter) =>
      parameter?.in === "header" && parameter?.name?.toLowerCase() === "x-client-platform",
  );
  const values = platformHeader?.schema?.enum;
  if (!Array.isArray(values) || !values.includes("web") || !values.includes("mobile")) {
    failures.push(`${method.toUpperCase()} ${apiPath} 缺少 web/mobile X-Client-Platform 契约`);
  }
}

for (const requiredPath of [
  "/api/v1/meta",
  "/api/v1/mobile/devices/current",
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
]) {
  if (!spec.paths?.[requiredPath]) failures.push(`缺少 Flutter 基线端点 ${requiredPath}`);
}
if (!spec.components?.schemas?.BusinessErrorCode) {
  failures.push("缺少可生成的 BusinessErrorCode schema");
}

if (failures.length > 0) {
  throw new Error(`Flutter 契约兼容检查失败：\n${failures.join("\n")}`);
}
console.log(`Flutter contract shape is valid (${operationIds.size} operations)`);
