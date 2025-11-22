// frontend/src/admin/api.ts

// ===== Типы данных (auth) =====
export type Role = "operator" | "manager" | "admin";

export interface SessionUser {
  email?: string;
  tg_id?: number | null;
  role: Role;
}

export interface SessionResponse {
  user: SessionUser;
}

export interface TelegramStartResponse {
  nonce: string;
  deep_link: string;
}

export interface TelegramWaitResponse {
  ready: boolean;
  user: { tg_id: number; role: Role };
}

// ======================================================
//   ВАЖНО: НИКАКОГО BEARER — admin работает по cookies
// ======================================================
async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const hasBody = init.body !== undefined && init.body !== null;

  // Автоматический JSON
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const resp = await fetch(input, {
    ...init,
    headers,
    credentials: "include", // ← ОБЯЗАТЕЛЬНО для админки
  });

  if (!resp.ok) {
    let text;
    try {
      text = await resp.text();
    } catch {
      text = `${resp.status} ${resp.statusText}`;
    }
    throw new Error(text || "Request failed");
  }

  return resp;
}

// ===== Авторизация =====
export async function emailSignIn(email: string, password: string): Promise<SessionResponse> {
  const r = await authedFetch("/admin/auth/email-session", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}

export async function startTelegram(): Promise<TelegramStartResponse> {
  const r = await authedFetch("/admin/auth/telegram/start");
  return r.json();
}

export async function waitTelegram(nonce: string, tries = 60): Promise<TelegramWaitResponse> {
  for (let i = 0; i < tries; i++) {
    const r = await authedFetch("/admin/auth/telegram/wait", {
      method: "POST",
      body: JSON.stringify({ nonce }),
    });
    const data: TelegramWaitResponse = await r.json();
    if (data.ready) return data;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("Timeout waiting for Telegram confirmation");
}

export async function me(): Promise<SessionResponse> {
  const r = await authedFetch("/admin/auth/me");
  return r.json();
}

export async function logout(): Promise<void> {
  await authedFetch("/admin/auth/logout", { method: "POST" });
}

// ===== Admin: Requests =====

// статусы как в admin_requests_v / backend
export type DbStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "done"
  | "cancelled"
  | "cancelled_by_user";

export interface AdminRequest {
  id: string;
  status: DbStatus;
  category?: string | null;
  service?: string | null;
  service_code?: string | null;
  service_title?: string | null;
  name?: string | null;
  username?: string | null;
  resident?: string | null;
  phone?: string | null;
  resident_phone?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  unit?: string | null;
  resident_unit_text?: string | null;
  unit_number?: string | null;
  address?: string | null;
  property_name?: string | null;
  title?: string | null;
  description?: string | null;
  details?: string | null;
  desritption?: string | null;
  desc?: string | null;
  preferred_time?: string | null;
  due_at?: string | null;
  priority?: "low" | "normal" | "high" | "urgent" | null;
  internal_only?: boolean | null;
  auto_assign?: boolean | null;
  assignee?: string | null;
  photos?: Array<{ url?: string; path?: string; name?: string }> | null;
  photo_paths?: string[] | null;
  photo_urls?: string[] | null;
  attachments?: any[] | null;
  photo?: string | null;
  image?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminRequestMessage {
  id: string;
  request_id: string;
  author_id: string;
  author_role: string;
  body: string;
  created_at: string;
}

export type RequestMessage = AdminRequestMessage;

const FULL_SELECT = [
  "id",
  "status",
  "category",
  "service",
  "service_code",
  "service_title",
  "name",
  "username",
  "resident",
  "phone",
  "resident_phone",
  "contact_name",
  "contact_phone",
  "unit",
  "resident_unit_text",
  "unit_number",
  "address",
  "property_name",
  "title",
  "description",
  "details",
  "desritption",
  "desc",
  "preferred_time",
  "due_at",
  "priority",
  "internal_only",
  "auto_assign",
  "assignee",
  "photos",
  "photo_paths",
  "photo_urls",
  "attachments",
  "photo",
  "image",
  "created_at",
  "updated_at",
].join(",");

export async function adminListRequests(params?: {
  status?: DbStatus | "all";
  q?: string;
  limit?: number;
  offset?: number;
  select?: string;
}): Promise<AdminRequest[]> {
  const url = new URL("/admin/requests", window.location.origin);
  url.searchParams.set("select", params?.select || FULL_SELECT);
  if (params?.status && params.status !== "all") {
    url.searchParams.set("status", params.status);
  }
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));

  const r = await authedFetch(url.toString());
  return r.json();
}

export async function adminGetRequest(id: string): Promise<AdminRequest> {
  const url = new URL(`/admin/requests/${id}`, window.location.origin);
  if (!url.searchParams.get("select")) {
    url.searchParams.set("select", FULL_SELECT);
  }
  const r = await authedFetch(url.toString());
  return r.json();
}

export async function adminUpdateStatus(id: string, status: DbStatus): Promise<AdminRequest> {
  const r = await authedFetch(`/admin/requests/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
  return r.json();
}

export async function adminAssign(id: string, assignee?: string): Promise<AdminRequest> {
  const r = await authedFetch(`/admin/requests/${id}/assign`, {
    method: "POST",
    body: JSON.stringify({ assignee: assignee ?? null }),
  });
  return r.json();
}

export async function adminDeleteRequest(id: string): Promise<{ ok: boolean; id: string }> {
  const r = await authedFetch(`/admin/requests/${id}`, { method: "DELETE" });
  return r.json();
}

// ===== Admin: Request messages (чат) =====
export async function adminListRequestMessages(
  requestId: string
): Promise<AdminRequestMessage[]> {
  const r = await authedFetch(`/admin/requests/${requestId}/messages`);
  return r.json();
}

export async function adminCreateRequestMessage(
  requestId: string,
  body: string
): Promise<AdminRequestMessage> {
  const r = await authedFetch(`/admin/requests/${requestId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return r.json();
}