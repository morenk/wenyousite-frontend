import { NextRequest, NextResponse } from "next/server";

import { createContentSecurityPolicy } from "./src/lib/security-headers";

const isDevelopment = process.env.NODE_ENV === "development";

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const contentSecurityPolicy = createContentSecurityPolicy({
    nonce,
    isDevelopment,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
