import type { StatusUI } from "./status";

export async function requestNotifyPermission() {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

export function notifyBrowser(title: string, body?: string) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body });
  } catch {
    // ignore
  }
}

export function notifyStatusChange(id: string, next: StatusUI) {
  try {
    const title =
      next === "in_progress"
        ? "Request confirmed"
        : next === "done"
        ? "Request completed"
        : next === "canceled"
        ? "Request canceled"
        : "Request updated";
    notifyBrowser(title, `#${id} is now ${next}`);
  } catch {}
}
