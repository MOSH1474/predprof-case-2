const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const buildUrl = (path) => {
  if (path.startsWith("http")) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }
  return `${API_BASE}/${path}`;
};

const extractErrorMessage = (payload) => {
  if (!payload) {
    return "Ошибка запроса";
  }
  if (typeof payload === "string") {
    return payload;
  }
  const detail = payload.detail ?? payload.message;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || String(item)).join(", ");
  }
  return "Ошибка запроса";
};

const triggerUnauthorized = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent("auth:logout", { detail: { reason: "unauthorized" } }));
};

export async function apiRequest(path, options = {}) {
  const { method = "GET", token, body, isForm = false, headers } = options;
  const requestHeaders = new Headers(headers || {});

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let payload;
  if (body !== undefined) {
    if (isForm) {
      payload = new URLSearchParams(body);
      requestHeaders.set("Content-Type", "application/x-www-form-urlencoded");
    } else {
      payload = JSON.stringify(body);
      requestHeaders.set("Content-Type", "application/json");
    }
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401 && token) {
      triggerUnauthorized();
      throw new Error("Сессия истекла. Войдите снова.");
    }
    throw new Error(extractErrorMessage(data));
  }

  return data;
}
