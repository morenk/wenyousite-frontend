import createClient from "openapi-fetch";
import type { paths } from "./types";

function getBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL || "http://127.0.0.1:3000";
  }
  return "";
}

export const apiClient = createClient<paths>({ baseUrl: getBaseUrl() });

apiClient.use({
  onRequest({ request }) {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("accessToken");
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    request.headers.set("X-Client-Platform", "web");
  },
});

apiClient.use({
  onResponse({ response }) {
    if (typeof window === "undefined") return;
    if (response.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-change"));
      window.location.href = "/login";
    }
  },
});

export type ApiClient = typeof apiClient;
