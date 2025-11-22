import React, { useEffect, useMemo, useRef, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { AnimatePresence, motion } from "framer-motion";

import { t, type Lang } from "./i18n";
import type { ServiceCode } from "./types";

import Header from "./components/Header";
import RegistrationForm from "./components/RegistrationForm";
import MenuGrid from "./components/MenuGrid";
import Services from "./components/Services";
import RequestForm from "./components/RequestForm";
import RequestsHistory from "./components/RequestsHistory";
import Profile from "./components/Profile";
import Map from "./components/Map";
import { BottomNav } from "./components/BottomNav";

import { apiGet, apiPost } from "./api/client";
import { onUnauthorized } from "@/api/client";

// 🔽 Success screen мини-аппа
import { MiniAppSuccessScreen } from "./components/SuccessScreens";

// 🔽 Новый экран деталей заявки
import { RequestDetailsScreen } from "./views/RequestDetailsScreen";

onUnauthorized(() => {
  try {
    history.replaceState({}, "", "#auth");
    console.warn("🔒 Unauthorized → switched to #auth");
  } catch {}
});

// 🔽 ФОЛЛБЭКИ ИЗ TELEGRAM
import {
  pickName as tgPickName,
  pickLang as tgPickLang,
  pickAvatar as tgPickAvatar,
  pickUsername as tgPickUsername,
} from "./telegram/fallbacks";

/** ——— helpers ——— */
type Screen =
  | "menu"
  | "services"
  | "request"
  | "history"
  | "requestDetails" // 🔹 новый экран
  | "profile"
  | "map"
  | "auth"
  | "news"
  | "payments"
  | "operator";

function Payments() {
  return <div style={{ padding: 16 }}>💳 Payments section will be here later</div>;
}

const ALLOWED: Lang[] = ["ru", "en", "km", "zh"];
const norm = (v?: string | null): Lang | null => {
  const s = (v || "").toLowerCase();
  return (ALLOWED as string[]).includes(s) ? (s as Lang) : null;
};

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.16, ease: "easeOut" as const },
};

// Если нет фото — рисуем инициалы
function initialsFromName(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/);
  const a = parts[0]?.[0] || "U";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

// --- утилита uniq ---
const uniq = <T,>(a: T[]) => Array.from(new Set(a));

// --- Roles priority (admin > manager > operator > resident)
const ROLE_PRIORITY = ["admin", "manager", "operator", "resident"] as const;
const STAFF = new Set(["admin", "manager", "operator"]);
const sortByPriority = (arr: string[]) =>
  [...arr].sort((a, b) => ROLE_PRIORITY.indexOf(a as any) - ROLE_PRIORITY.indexOf(b as any));

// --- UI labels/colors для ролей ---
const ROLE_LABEL: Record<string, string> = {
  resident: "Resident",
  operator: "Operator",
  manager: "Manager",
  admin: "Admin",
};

const ROLE_COLOR: Record<string, string> = {
  resident: "#9CA3AF", // gray
  operator: "#3B82F6", // blue
  manager: "#F59E0B",  // amber
  admin: "#EF4444",    // red
};

// --- Надёжный парсер ролей (array | json | pg-array | csv | string) ---
function parseRoles(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  const s = String(raw).trim();
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith('"[') && s.endsWith(']"'))) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {}
  }
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1);
    return inner
      .split(",")
      .map((x) => x.replace(/^"(.*)"$/, "$1").trim())
      .filter(Boolean);
  }
  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
  return s ? [s] : [];
}

// Минимальные требования профиля до разблокировки
const isProfileComplete = (u: any) => {
  const nameOk = !!(u?.name && String(u.name).trim());
  const unitOk = !!(u?.unit && String(u.unit).trim());
  const phoneOk = !!(u?.phone && String(u.phone).trim());
  const langOk = !!(u?.language && String(u.language).trim());
  return nameOk && unitOk && phoneOk && langOk;
};

/* =========================
   Operator Workspace + Modal
   ========================= */

function OperatorWorkspace({
  lang,
  onOpenNew,
}: {
  lang: Lang;
  onOpenNew: () => void;
}) {
  return (
    <div className="px-2">
      <div className="uv-card" style={{ padding: 16 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold tracking-tight">Operator Workspace</div>
            <div className="text-sm text-neutral-500">Dashboard</div>
          </div>
          <button
            onClick={onOpenNew}
            className="px-4 py-2 rounded-2xl font-medium"
            style={{
              background: "#000",
              color: "#fff",
              border: "1px solid #000",
              boxShadow: "0 10px 26px rgba(0,0,0,.12)",
            }}
          >
            New Request
          </button>
        </div>

        <div className="mt-6 grid gap-12">
          <div className="grid grid-cols-2 gap-12">
            <div className="uv-card" style={{ padding: 16 }}>
              <div className="text-sm text-neutral-500">Open Requests</div>
              <div className="text-3xl font-semibold mt-1">—</div>
            </div>
            <div className="uv-card" style={{ padding: 16 }}>
              <div className="text-sm text-neutral-500">Assigned to me</div>
              <div className="text-3xl font-semibold mt-1">—</div>
            </div>
          </div>

          <div className="uv-card" style={{ padding: 16 }}>
            <div className="text-sm text-neutral-500 mb-2">Recent activity</div>
            <div className="text-neutral-800 opacity-80">Coming soon…</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewRequestModal({
  onClose,
  onSuccess,
  lang,
}: {
  onClose: () => void;
  onSuccess: () => void;
  lang: Lang;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[300] grid place-items-center"
      style={{ background: "rgba(0,0,0,.4)" }}
      aria-modal
      role="dialog"
    >
      <div className="uv-card w-full max-w-screen-sm" style={{ padding: 16 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">New Request</div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md border"
            style={{ background: "#fff", borderColor: "rgba(0,0,0,.12)" }}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <RequestForm
          lang={lang}
          isStaff
          onDone={(ok) => {
            if (ok) onSuccess();
            onClose();
          }}
        />
      </div>
    </div>
  );
}

/* =========================
   App
   ========================= */

export default function App() {
  /** ---------- STATE ---------- */
  const [lang, setLang] = useState<Lang>(() => {
    const last = localStorage.getItem("uv.lang.__last");
    if (last && (ALLOWED as string[]).includes(last)) return last as Lang;
    const lc =
      (WebApp?.initDataUnsafe as any)?.user?.language_code?.slice(0, 2)?.toLowerCase() ||
      (navigator.language || "ru").slice(0, 2).toLowerCase();
    const map: Record<string, Lang> = { ru: "ru", en: "en", km: "km", zh: "zh" };
    return map[lc] ?? "ru";
  });
  const [tgId, setTgId] = useState<number | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  const [roles, setRoles] = useState<string[]>([]);

  const initialMustRegister = localStorage.getItem("reg_done") !== "1";
  const [mustRegister, setMustRegister] = useState<boolean>(initialMustRegister);

  const [screen, setScreen] = useState<Screen>(initialMustRegister ? "auth" : "menu");
  const [selectedCode, setSelectedCode] = useState<ServiceCode | null>(null);
  const [cameFrom, setCameFrom] = useState<null | "menu" | "history">(null);
  const [initData, setInitData] = useState<string | null>(null);

  // id заявки, открытой в деталях
  const [openedRequestId, setOpenedRequestId] = useState<string | null>(null);

  /** boot & auth boom transitions */
  const [bootSplash, setBootSplash] = useState(true);
  const [authBoom, setAuthBoom] = useState(false);
  const bootDoneRef = useRef(false);

  // состояние для success-экрана
  const [successScreen, setSuccessScreen] = useState<{ requestId?: string } | null>(null);

  useEffect(() => {
    if (!bootSplash) return;
    const timer = window.setTimeout(() => setBootSplash(false), 1000);
    return () => window.clearTimeout(timer);
  }, [bootSplash]);

  useEffect(() => {
    if (!authBoom) return;
    const timer = window.setTimeout(() => setAuthBoom(false), 1000);
    return () => window.clearTimeout(timer);
  }, [authBoom]);

  /** ---------- LANGUAGE HELPERS ---------- */
  const lsSetLang = (lng: Lang, tg?: number | null) => {
    localStorage.setItem("uv.lang.__last", lng);
    if (tg) localStorage.setItem(`uv.lang.${tg}`, lng);
  };

  const persistLang = async (lng: Lang, tg?: number | null) => {
    setLang(lng);
    lsSetLang(lng, tg);
    try {
      await apiPost("/api/profile", { language: lng.toUpperCase() });
    } catch (e) {
      console.warn("persistLang failed:", e);
    }
  };

  /** ---------- INIT (hash) ---------- */
  useEffect(() => {
    if (mustRegister) return;
    const hash = (location.hash || "").replace("#", "");

    // 🔹 если deep-link вида #request-<id> — сразу в детали заявки
    if (hash.startsWith("request-")) {
      const id = hash.slice("request-".length);
      if (id) {
        setOpenedRequestId(id);
        setScreen("requestDetails");
      }
      return;
    }

    switch (hash) {
      case "history":
        setScreen("history");
        break;
      case "services":
        setScreen("services");
        break;
      case "profile":
        setScreen("profile");
        break;
      case "map":
        setScreen("map");
        break;
      case "news":
        setScreen("news");
        break;
      case "payments":
        setScreen("payments");
        break;
      case "operator":
        setScreen("operator");
        break;
    }
  }, [mustRegister]);

  /** ---------- THEME / TELEGRAM INIT ---------- */
  useEffect(() => {
    try {
      WebApp.ready?.();
      WebApp.expand?.();
      const bg = "#f6f7f9";
      const text = "#0a0a0a";
      const root = document.documentElement;
      root.style.setProperty("--bg", bg);
      root.style.setProperty("--text", text);
      root.style.setProperty("--bar-bg", "rgba(0,0,0,0.06)");
      root.style.setProperty("--card-bg", "#ffffff");
      root.style.setProperty("--card-bg-active", "#ffffff");
      root.style.setProperty("--card-brd", "rgba(0,0,0,0.10)");
      document.body.style.background = bg;
      document.body.style.color = text;
      setInitData(WebApp.initData || "");
    } catch {
      document.body.style.background = "#f6f7f9";
      document.body.style.color = "#0a0a0a";
      setInitData("");
    }
  }, []);

  /** ---------- AUTH + PROFILE bootstrap (ПАРАЛЛЕЛЬНО) ---------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (initData == null || initData === "") {
        if (!bootDoneRef.current) {
          bootDoneRef.current = true;
          setTimeout(() => setBootSplash(false), 350);
        }
        return;
      }

      try {
        const [meRes, profRes] = await Promise.allSettled([
          apiPost("/api/auth/me"),
          apiGet("/api/profile"),
        ]);
        if (cancelled) return;

        const me = meRes.status === "fulfilled" ? meRes.value : null;
        const prof = profRes.status === "fulfilled" ? profRes.value : null;

        const dbUser = prof?.user ?? null;
        const user = { ...(me?.user || {}), ...(dbUser || {}) } as any;

        const prettyName =
          tgPickName(user.name) || tgPickUsername(user.username) || String(user.tg_id || "");
        setName(prettyName);
        setTgId(user.tg_id ?? null);

        const avatarUrl = tgPickAvatar((user.avatar_url as string) || (user.avatar as string));
        setAvatar(avatarUrl);

        const appLangRaw = tgPickLang((user.language as string) ?? null, lang);
        const nextLang = norm(appLangRaw) || lang;
        if (nextLang !== lang) setLang(nextLang);

        const fromMeA = parseRoles((me as any)?.roles);
        const fromMeB = parseRoles((me as any)?.user?.roles);
        const fromDbA = parseRoles((prof as any)?.roles);
        const fromDbB = parseRoles((prof as any)?.user?.roles);
        const fromUser = parseRoles((user as any)?.roles);

        let mergedRoles = uniq(
          [...fromMeA, ...fromMeB, ...fromDbA, ...fromDbB, ...fromUser]
            .map((r) => String(r).toLowerCase().trim())
            .filter(Boolean)
        );

        const hasStaff = mergedRoles.some((r) => STAFF.has(r));
        if (hasStaff) mergedRoles = mergedRoles.filter((r) => r !== "resident");

        mergedRoles = sortByPriority(mergedRoles);
        setRoles(mergedRoles);

        const last = localStorage.getItem("uv.lang.__last");
        if (user.tg_id && last && !localStorage.getItem(`uv.lang.${user.tg_id}`)) {
          localStorage.setItem(`uv.lang.${user.tg_id}`, last);
        }

        const needReg = !dbUser || !isProfileComplete(user);
        if (!needReg) {
          setMustRegister(false);
          localStorage.setItem("reg_done", "1");
          setScreen((prev) => (prev === "auth" ? "menu" : prev));
        } else {
          setMustRegister(true);
          setScreen("auth");
          history.replaceState({}, "", "#auth");
        }
      } catch {
        if (!cancelled) {
          setMustRegister(true);
          setScreen("auth");
          history.replaceState({}, "", "#auth");
        }
      } finally {
        if (!bootDoneRef.current) {
          bootDoneRef.current = true;
          setTimeout(() => setBootSplash(false), 350);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initData, lang]);

  /** ---------- HEALTH CHECK (фоново) ---------- */
  useEffect(() => {
    (async () => {
      try {
        await apiGet("/api/_diag/health");
      } catch {}
    })();
  }, []);

  /** ---------- BACK LOGIC ---------- */
  useEffect(() => {
    const onBack = () => {
      if (mustRegister) {
        setScreen("auth");
        history.replaceState({}, "", "#auth");
        return;
      }
      if (screen === "auth") return setScreen("menu");
      if (screen === "request") return setScreen("services");
      if (screen === "requestDetails") {
        setScreen("history");
        history.replaceState({}, "", "#history");
        return;
      }
      if (screen === "services") {
        if (cameFrom === "history") {
          setCameFrom(null);
          return setScreen("history");
        }
        return setScreen("menu");
      }
      if (screen !== "menu") return setScreen("menu");
      try {
        WebApp.close?.();
      } catch {}
    };

    try {
      WebApp.BackButton.show?.();
      WebApp.onEvent?.("backButtonClicked", onBack);
    } catch {}
    window.addEventListener("popstate", onBack);

    return () => {
      try {
        WebApp.offEvent?.("backButtonClicked", onBack);
      } catch {}
      window.removeEventListener("popstate", onBack);
    };
  }, [screen, cameFrom, mustRegister]);

  /** ---------- ROLES HELPERS ---------- */
  const hasRole = (r: string) => roles.includes(r);
  const anyRole = (arr: string[]) => arr.some(hasRole);
  const isOperator = anyRole(["operator", "manager", "admin"]);
  const primaryRole = useMemo(() => {
    const pick = (["admin", "manager", "operator"] as const).find((p) => roles.includes(p));
    return pick ?? null;
  }, [roles]);

  /** ---------- UTILS ---------- */
  const titleFor = (s: Screen) =>
    s === "menu"
      ? t(lang, "menu")
      : s === "services"
      ? t(lang, "services")
      : s === "request"
      ? t(lang, "createRequest")
      : s === "history"
      ? t(lang, "myRequests")
      : s === "requestDetails"
      ? "Request details"
      : s === "profile"
      ? t(lang, "profile")
      : s === "map"
      ? t(lang, "map")
      : s === "news"
      ? t(lang, "news")
      : s === "payments"
      ? t(lang, "payments")
      : s === "operator"
      ? "Operator Workspace"
      : "Urban";

  const headerTitle = useMemo(() => titleFor(screen), [screen, lang]);

  /** ---------- NAV HELPERS ---------- */
  const guard =
    <T extends any[]>(fn: (...a: T) => void) =>
    (...a: T) => {
      if (mustRegister) {
        setScreen("auth");
        history.replaceState({}, "", "#auth");
        return;
      }
      fn(...a);
    };

  const openMenu = guard(() => {
    setScreen("menu");
    history.pushState({}, "", "#menu");
  });
  const openHistory = guard(() => {
    setScreen("history");
    history.pushState({}, "", "#history");
  });
  const openProfile = () => {
    setScreen("profile");
    history.pushState({}, "", "#profile");
  };
  const openMap = guard(() => {
    setScreen("map");
    history.pushState({}, "", "#map");
  });
  const openNews = guard(() => {
    setScreen("news");
    history.pushState({}, "", "#news");
  });
  const openServices = guard((from: "menu" | "history" = "menu") => {
    setCameFrom(from);
    setScreen("services");
    history.pushState({}, "", "#services");
  });
  const pickService = guard((c: ServiceCode) => {
    setSelectedCode(c);
    setScreen("request");
    history.pushState({}, "", `#request-${c}`);
  });

  /** ---------- SMALL UI COMPONENTS ---------- */
  function RoleIndicatorDot({ role }: { role: string }) {
    return (
      <span
        title={ROLE_LABEL[role]}
        style={{
          position: "absolute",
          right: -2,
          bottom: -2,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: ROLE_COLOR[role],
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,.06)",
        }}
      />
    );
  }

  const AvatarEl = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: 32, height: 32 }}>
        {avatar ? (
          <img
            src={avatar}
            alt="avatar"
            onClick={openProfile}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/default-avatar.png";
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid rgba(0,0,0,.12)",
              cursor: "pointer",
            }}
          />
        ) : (
          <div
            onClick={openProfile}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#111",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(0,0,0,.12)",
              cursor: "pointer",
            }}
            aria-label="no-avatar"
            title="Open profile"
          >
            {initialsFromName(name)}
          </div>
        )}
        {primaryRole && <RoleIndicatorDot role={primaryRole} />}
      </div>

      <select
        style={{
          padding: "6px 10px",
          borderRadius: 14,
          boxShadow: "0 10px 28px rgba(0,0,0,.06)",
          border: "1px solid rgba(0,0,0,.10)",
          background: "#fff",
          color: "#0a0a0a",
        }}
        value={lang}
        onChange={(e) => persistLang(e.target.value as Lang, tgId)}
        aria-label="Language"
      >
        <option value="ru">🇷🇺 Русский</option>
        <option value="en">🇬🇧 English</option>
        <option value="km">🇰🇭 ភាសាខ្មែរ</option>
        <option value="zh">🇨🇳 中文</option>
      </select>
    </div>
  );

  /** ---------- RENDER ---------- */
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: "#f6f7f9" }}>
      {/* Глобальные правки под экосистемный стиль */}
      <style>{`
        .uv-card {
          border-radius: 24px;
          background: #fff;
          border: 1px solid rgba(0,0,0,.10);
          box-shadow: 0 14px 40px rgba(0,0,0,.05);
        }
        button, .btn { border-radius: 14px; }
        .btn-black, button[data-variant="default"] {
          background:#000 !important; color:#fff !important; border:1px solid #000 !important;
        }
        .btn-outline, button[data-variant="outline"], button.uv-outline {
          background:#fff !important; color:#000 !important; border:1px solid rgba(0,0,0,.14) !important;
        }
        .uv-bnav, .uv-bnav * { color:#111; }
        .uv-bnav .active,
        .uv-bnav [aria-current="page"],
        .uv-bnav [data-active="true"]{
          background:#000 !important; color:#fff !important; border-color:#000 !important;
        }
        select { background:#fff; color:#0a0a0a; border:1px solid rgba(0,0,0,.10); }
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      {/* HEADER */}
      <Header
        title={headerTitle}
        subtitle={screen === "menu" && name ? String(name) : undefined}
        showBack={screen !== "menu"}
        onBack={() => {
          if (mustRegister) {
            setScreen("auth");
            history.replaceState({}, "", "#auth");
            return;
          }
          if (screen === "auth") return setScreen("menu");
          if (screen === "request") return setScreen("services");
          if (screen === "requestDetails") {
            setScreen("history");
            history.replaceState({}, "", "#history");
            return;
          }
          if (screen === "services") {
            if (cameFrom === "history") {
              setCameFrom(null);
              return setScreen("history");
            }
            return setScreen("menu");
          }
          if (screen !== "menu") return setScreen("menu");
        }}
        rightSlot={AvatarEl}
      />

      {/* Узкая верхняя панель: Operator Workspace (только staff) */}
      {primaryRole && (
        <div
          className="px-2 py-2"
          style={{ background: "transparent", display: "flex", justifyContent: "center" }}
        >
          <button
            onClick={() => {
              setScreen("operator");
              history.pushState({}, "", "#operator");
            }}
            className="px-4 py-2 rounded-2xl font-medium"
            style={{
              background: "#0a0a0a",
              color: "#fff",
              border: "1px solid #0a0a0a",
              boxShadow: "0 10px 26px rgba(0,0,0,.12)",
              letterSpacing: 0.2,
            }}
            aria-label="Open Operator Workspace"
          >
            Operator Workspace
          </button>
        </div>
      )}

      {/* MAIN */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {mustRegister ? (
            <motion.div
              key="auth"
              {...pageVariants}
              className="relative"
              style={{ minHeight: "calc(100vh - 56px)" }}
            >
              <div className="mx-auto px-4" style={{ maxWidth: 560, paddingTop: 24 }}>
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ duration: 0.2 }}
                  className="uv-card"
                >
                  <div style={{ padding: 16 }}>
                    <RegistrationForm
                      lang={lang}
                      onDone={(u) => {
                        setName(u?.name || u?.username || String(u?.tg_id || ""));
                        const a = tgPickAvatar((u as any)?.avatar_url || (u as any)?.avatar);
                        setAvatar(a);

                        if (isProfileComplete(u)) {
                          setAuthBoom(true);
                          setMustRegister(false);
                          localStorage.setItem("reg_done", "1");
                          const chosen = String(u?.language || "EN").toLowerCase() as Lang;
                          if (chosen) {
                            (async () => {
                              try {
                                await persistLang(chosen, u?.tg_id ?? tgId);
                              } catch {}
                            })();
                          }
                          setTimeout(() => {
                            setAuthBoom(false);
                            setScreen("menu");
                          }, 360);
                        } else {
                          setScreen("auth");
                          history.replaceState({}, "", "#auth");
                        }
                      }}
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <>
              {screen === "menu" && (
                <motion.div key="menu" {...pageVariants} className="px-2">
                  <MenuGrid
                    lang={lang}
                    onOpenServices={() => openServices("menu")}
                    onOpenPayments={() => {
                      setScreen("payments");
                      history.pushState({}, "", "#payments");
                    }}
                  />
                </motion.div>
              )}

              {screen === "services" && (
                <motion.div key="services" {...pageVariants} className="px-2">
                  <Services lang={lang} selected={selectedCode} onPick={pickService} />
                </motion.div>
              )}

              {screen === "request" && selectedCode && (
                <motion.div key={`req-${selectedCode}`} {...pageVariants} className="px-2">
                  <RequestForm
                    lang={lang}
                    code={selectedCode}
                    onDone={(ok) => {
                      if (ok) {
                        setScreen("history");
                        history.pushState({}, "", "#history");
                        setSuccessScreen({});
                      }
                    }}
                  />
                </motion.div>
              )}

              {screen === "history" && (
                <motion.div key="history" {...pageVariants} className="px-2">
                  <RequestsHistory
                    lang={lang}
                    onCreateRequest={() => openServices("history")}
                    onOpenRequest={(id: string) => {
                      setOpenedRequestId(id);
                      setScreen("requestDetails");
                      history.pushState({}, "", `#request-${id}`);
                    }}
                  />
                </motion.div>
              )}

              {screen === "requestDetails" && openedRequestId && (
                <motion.div
                  key={`request-details-${openedRequestId}`}
                  {...pageVariants}
                  className="px-2"
                >
                  <RequestDetailsScreen
                    lang={lang}
                    requestId={openedRequestId}
                    onBack={() => {
                      setScreen("history");
                      history.replaceState({}, "", "#history");
                    }}
                  />
                </motion.div>
              )}

              {screen === "profile" && (
                <motion.div key="profile" {...pageVariants} className="px-2">
                  <div className="uv-card" style={{ padding: 16 }}>
                    <div className="text-neutral-900">
                      <Profile
                        lang={lang}
                        onSaved={(u) => {
                          if (u?.name) setName(u.name);
                          const ul = norm((u?.language as any) || null);
                          if (ul) persistLang(ul, (u as any)?.tg_id ?? tgId);
                          const a =
                            tgPickAvatar((u as any)?.avatar_url || (u as any)?.avatar) || null;
                          setAvatar(a);
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {screen === "map" && (
                <motion.div key="map" {...pageVariants} className="px-2">
                  <Map lang={lang} />
                </motion.div>
              )}

              {screen === "news" && (
                <motion.div key="news" {...pageVariants} className="px-2">
                  <div className="uv-card" style={{ padding: 16 }}>
                    <div className="text-neutral-900 opacity-85">{t(lang, "news")}</div>
                  </div>
                </motion.div>
              )}

              {screen === "payments" && (
                <motion.div key="payments" {...pageVariants} className="px-2">
                  <div className="uv-card" style={{ padding: 16 }}>
                    <Payments />
                  </div>
                </motion.div>
              )}

              {screen === "operator" && (
                <motion.div key="operator" {...pageVariants}>
                  <OperatorWorkspace lang={lang} onOpenNew={() => setShowNewModal(true)} />
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </main>

      {/* BOTTOM NAV */}
      {!mustRegister && screen !== "auth" && (
        <footer className="sticky bottom-0 left-0 right-0 bg-white border-t border-black/10">
          <div className="max-w-screen-md mx-auto uv-bnav">
            <BottomNav
              lang={lang}
              active={
                screen === "history" || screen === "requestDetails"
                  ? "history"
                  : screen === "menu"
                  ? "menu"
                  : screen === "services" || screen === "request"
                  ? "menu"
                  : screen === "map"
                  ? "map"
                  : screen === "profile"
                  ? "profile"
                  : "news"
              }
              onChange={(s) => {
                if (s === "history") return openHistory();
                if (s === "menu") return openMenu();
                if (s === "map") return openMap();
                if (s === "profile") return openProfile();
                if (s === "news") return openNews();
              }}
            />
          </div>
        </footer>
      )}

      {/* Boot splash overlay */}
      <AnimatePresence>
        {bootSplash && (
          <motion.div
            key="boot-splash"
            className="fixed inset-0 z-[200] grid place-items-center bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex flex-col items-center gap-2 text-neutral-900"
            >
              <div className="text-2xl font-semibold tracking-tight">Urban Village</div>
              <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">loading</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Short auth confirmation flash */}
      <AnimatePresence>
        {authBoom && (
          <motion.div
            key="auth-boom"
            className="fixed inset-0 z-[180] grid place-items-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="rounded-full bg-emerald-500/90 text-white px-6 py-3 text-sm font-medium shadow-lg"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              Account activated
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Request Modal */}
      <AnimatePresence>
        {showNewModal && (
          <NewRequestModal
            lang={lang}
            onClose={() => setShowNewModal(false)}
            onSuccess={() => {
              // TODO: refresh виджеты воркспейса (open/assigned counts)
            }}
          />
        )}
      </AnimatePresence>

      {/* Success screen overlay после создания заявки */}
      {successScreen && (
        <div className="fixed inset-0 z-[400]">
          <MiniAppSuccessScreen
            requestId={successScreen.requestId}
            onClose={() => {
              setSuccessScreen(null);
              setScreen("history");
              history.replaceState({}, "", "#history");
            }}
            onOpenRequest={() => {
              setSuccessScreen(null);
              setScreen("history");
              history.replaceState({}, "", "#history");
            }}
          />
        </div>
      )}

      {/* DEV: floating role switcher */}
      {import.meta.env.DEV || localStorage.getItem("uv.dev.roles") === "1" ? (
        <DevRoles
          roles={roles}
          setRolesFromOverride={(next) => {
            const clean = uniq(next.map((x) => x.toLowerCase().trim()).filter(Boolean));
            const ordered = sortByPriority(
              clean.some((r) => STAFF.has(r)) ? clean.filter((r) => r !== "resident") : clean
            );
            localStorage.setItem("uv.override.roles", JSON.stringify(ordered));
            // @ts-ignore
            setRoles(ordered);
          }}
        />
      ) : null}
    </div>
  );
}

/** mini dev switcher */
function DevRoles({
  roles,
  setRolesFromOverride,
}: {
  roles: string[];
  setRolesFromOverride: (next: string[]) => void;
}) {
  const toggleRole = (r: string) => {
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    setRolesFromOverride(next);
  };
  return (
    <div
      className="fixed bottom-4 right-4 z-[250] bg-white/95 backdrop-blur border border-black/10 shadow-xl rounded-2xl"
      style={{ padding: 12, minWidth: 220 }}
    >
      <div className="text-[11px] uppercase tracking-widest mb-2 text-neutral-500">
        Roles (DEV)
      </div>
      <div className="flex flex-wrap gap-8">
        {["resident", "operator", "manager", "admin"].map((r) => (
          <button
            key={r}
            onClick={() => toggleRole(r)}
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: roles.includes(r) ? "#0a0a0a" : "#fff",
              color: roles.includes(r) ? "#fff" : "#0a0a0a",
              border: "1px solid rgba(0,0,0,.12)",
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex gap-8 mt-10">
        <button
          className="px-2.5 py-1 rounded-md text-xs border border-black/10"
          onClick={() => setRolesFromOverride([])}
        >
          Clear
        </button>
        <button
          className="px-2.5 py-1 rounded-md text-xs border border-black/10"
          onClick={() => {
            localStorage.removeItem("uv.override.roles");
            location.reload();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}