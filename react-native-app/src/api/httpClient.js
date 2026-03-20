import * as Constants from "expo-constants";

function toBaseUrl(hostValue) {
  if (!hostValue || typeof hostValue !== "string") return null;

  const raw = hostValue.trim();
  if (!raw) return null;

  let host = raw;

  // e.g. "http://192.168.0.10:8081"
  if (/^https?:\/\//i.test(raw)) {
    try {
      host = new URL(raw).hostname;
    } catch {
      host = raw.split("/")[2] || raw;
    }
  }

  host = host.split(":")[0];
  if (!host) return null;

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return null;
  }

  return `http://${host}:8000`;
}

function collectHostCandidates() {
  const candidates = [];

  const c = Constants || {};
  const cDefault = c.default || {};
  const pushIf = (value) => {
    if (typeof value === "string" && value.trim()) {
      candidates.push(value.trim());
    }
  };

  pushIf(process.env.EXPO_PUBLIC_API_BASE_URL);

  const objects = [c, cDefault];
  for (const obj of objects) {
    pushIf(obj.expoConfig?.hostUri);
    pushIf(obj.hostUri);
    pushIf(obj.manifest?.debuggerHost);
    pushIf(obj.manifest2?.debuggerHost);
    pushIf(obj.expoGoConfig?.hostUri);
    pushIf(obj.expoGoConfig?.debuggerHost);
  }

  // Fallback for possible nested legacy manifest shape
  if (c.expoConfig?.extra?.hostUri) {
    pushIf(c.expoConfig.extra.hostUri);
  }
  if (c.manifest2?.metadata?.hostUri) {
    pushIf(c.manifest2.metadata.hostUri);
  }

  return candidates;
}

const API_BASE_URL = (() => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim();
  }

  for (const candidate of collectHostCandidates()) {
    const url = toBaseUrl(candidate);
    if (url) {
      return url;
    }
  }

  return "http://127.0.0.1:8000";
})();

export const DEFAULT_DRIVER_TOKEN = "DRIVER_TOKEN_1";

export function authHeader(token) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function requestJson({ method = "GET", path, body, headers = {} }) {
  const controller = new AbortController();
  const timeoutMs = 12000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = parseJsonSafe(text);

    if (!response.ok) {
      const detail = data?.detail || data?.message || "API error";
      throw new Error(`${detail} (HTTP ${response.status})`);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timeout (${timeoutMs}ms) to ${API_BASE_URL}`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Network request failed. Check EXPO_PUBLIC_API_BASE_URL (${API_BASE_URL}) and backend accessibility.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export { API_BASE_URL };
export default requestJson;
