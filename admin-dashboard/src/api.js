// All calls to the Express admin API live here.

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
const TOKEN_KEY = "fb_admin_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: token lives only for this page load */
  }
}

// Called by the app when any request says the admin token is no longer valid.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code || "error");
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "مش قادر أوصل للسيرفر");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    if (res.status === 401 && path !== "/admin/login") {
      setToken("");
      onUnauthorized();
    }
    throw new ApiError(res.status, data.code, data.message);
  }
  return data;
}

const qs = (params) =>
  "?" +
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

export const api = {
  async login(password) {
    const data = await request("POST", "/admin/login", { password });
    setToken(data.token);
    return data;
  },
  logout() {
    setToken("");
  },
  games: () => request("GET", "/admin/games"),
  stats: (gameId) => request("GET", "/admin/stats" + qs({ gameId })),
  users: (params) => request("GET", "/admin/users" + qs(params)),
  kick: (id) => request("POST", `/admin/users/${id}/kick`, {}),
  ban: (id, reason) => request("POST", `/admin/users/${id}/ban`, { reason }),
  unban: (id) => request("POST", `/admin/users/${id}/unban`, {}),
  setPassword: (id, newPassword) => request("POST", `/admin/users/${id}/password`, { newPassword }),
  remove: (id) => request("DELETE", `/admin/users/${id}`),
  clearAlert: (id) => request("POST", `/admin/users/${id}/clear-alert`, {}),
};

// Arabic messages for the error codes the server returns.
const MESSAGES = {
  NETWORK: "مش قادر أوصل للسيرفر",
  WRONG_PASSWORD: "الباسورد غلط",
  TOO_MANY_ATTEMPTS: "محاولات كتير غلط، استنى 5 دقايق",
  ADMIN_DISABLED: "الداش بورد مقفولة: حط ADMIN_PASSWORD في .env بتاع السيرفر",
  INVALID_INPUT: "البيانات مش صح",
  NOT_FOUND: "اليوزر مش موجود",
  SERVER_ERROR: "حصل خطأ في السيرفر",
};

export function errorText(err) {
  return MESSAGES[err && err.code] || (err && err.message) || "حصل خطأ";
}
