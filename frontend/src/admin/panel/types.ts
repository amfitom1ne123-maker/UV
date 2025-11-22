export type Page =
  | "login"
  | "dashboard"
  | "requests"
  | "request"
  | "services"
  | "team"
  | "settings";

export type Role = "operator" | "manager" | "admin";

export type User = { name: string; role: Role; email?: string; tg_id?: number };

export type TelegramWaitResponse = {
  ready: boolean;
  user?: { tg_id?: number; role: Role };
  expired?: boolean;
};
