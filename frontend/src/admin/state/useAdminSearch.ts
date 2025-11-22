import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { SetStateAction } from "react";
import { STORAGE_KEYS } from "../hooks/useFiltersState";

type Listener = (value: string) => void;

const listeners = new Set<Listener>();
let currentQuery = "";
let initialized = false;

const isBrowser = () => typeof window !== "undefined";

function readFromStorage(): string {
  if (!isBrowser()) return "";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.search);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : "";
  } catch {
    return "";
  }
}

function writeToStorage(value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.search, JSON.stringify(value));
  } catch {
    // swallow quota or private mode errors
  }
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  currentQuery = readFromStorage();
}

function notify() {
  listeners.forEach((listener) => listener(currentQuery));
}

function applyUpdate(update: SetStateAction<string>) {
  ensureInitialized();
  const next =
    typeof update === "function" ? (update as (prev: string) => string)(currentQuery) : update;
  const normalized = typeof next === "string" ? next : "";
  if (normalized === currentQuery) return;
  currentQuery = normalized;
  writeToStorage(currentQuery);
  notify();
}

export function useAdminSearch() {
  ensureInitialized();

  const subscribe = useCallback((listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    ensureInitialized();
    return currentQuery;
  }, []);

  const getServerSnapshot = useCallback(() => "", []);

  const query = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setQuery = useCallback((value: SetStateAction<string>) => {
    applyUpdate(value);
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.search) return;
      ensureInitialized();
      if (event.newValue === null) {
        if (currentQuery !== "") {
          currentQuery = "";
          notify();
        }
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        if (typeof parsed !== "string" || parsed === currentQuery) {
          return;
        }
        currentQuery = parsed;
        notify();
      } catch {
        // ignore malformed payloads
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return { query, setQuery };
}
