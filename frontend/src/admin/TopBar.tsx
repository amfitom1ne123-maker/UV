import React from "react";
import { Input } from "@/ui/Input";
import { Button } from "@/ui/Button";
import { Search, Bell } from "lucide-react";

// Предполагаем, что где-то есть глобальный стейт поиска
// Пример: useAdminSearch() возвращает query и setQuery
import { useAdminSearch } from "@/admin/state/useAdminSearch";

export default function TopBar() {
  const { query, setQuery } = useAdminSearch();

  return (
    <div className="sticky top-0 z-40 h-14 bg-white border-b border-[var(--border)]">
      <div className="mx-auto max-w-[1240px] h-full px-4 flex items-center gap-3">
        <div className="text-[15px] font-semibold">Urban Admin</div>

        <div className="flex-1 max-w-[640px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} />
            <Input
              className="pl-10"
              placeholder="Global search (requests, users, services)…"
              value={query}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <Button variant="ghost" aria-label="Notifications" className="h-11 w-11 p-0">
          <Bell size={18} />
        </Button>
      </div>
    </div>
  );
}
