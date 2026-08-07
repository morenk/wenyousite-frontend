import { setupServer } from "msw/node";

/** Vitest 共享的真实 HTTP 边界；每个测试自行通过 server.use 声明契约响应。 */
export const server = setupServer();
