// src/navigation.ts
import { useEffect, useMemo, useState } from "react";

export type Screen =
  | "menu"        // главная
  | "services"    // каталог услуг
  | "request"     // создание заявки
  | "history"     // мои заявки
  | "news"
  | "bills"
  | "map"
  | "profile"
  | "auth";

export type Route = { name: Screen; q?: Record<string, string | number | boolean> };

function encodeQuery(q?: Route["q"]) {
  if (!q) return "";
  const sp = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => sp.set(k, String(v)));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function toHash(r: Route) {
  return `#/${r.name}${encodeQuery(r.q)}`;
}

export function fromHash(hash: string): Route | null {
  if (!hash.startsWith("#/")) return null;
  const [path, query = ""] = hash.slice(2).split("?");
  const name = (path || "menu") as Screen;
  const sp = new URLSearchParams(query);
  const q: Route["q"] = {};
  sp.forEach((v, k) => (q[k] = v));
  return { name, q };
}

/** Хук навигации по hash с синхронизацией Back/Forward */
export function useHashNav(initial: Screen = "menu") {
  const [route, setRoute] = useState<Route>({ name: initial });

  useEffect(() => {
    const apply = () => {
      const r = fromHash(location.hash) ?? { name: initial };
      setRoute(r);
    };
    window.addEventListener("hashchange", apply);
    apply();
    return () => window.removeEventListener("hashchange", apply);
  }, [initial]);

  const api = useMemo(() => {
    const push = (r: Route) => {
      const h = toHash(r);
      if (location.hash !== h) location.hash = h;
    };
    const replace = (r: Route) => {
      const h = toHash(r);
      history.replaceState(null, "", h);
      setRoute(r);
    };
    const back = () => history.back();
    return { push, replace, back };
  }, []);

  return { route, ...api };
}
