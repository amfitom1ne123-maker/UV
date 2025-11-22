import React from "react";
import {
  ClipboardList,
  Users,
  Building2,
  Megaphone,
  ShieldCheck,
  Settings,
} from "lucide-react";

type AdminDest =
  | "requests"
  | "residents"
  | "units"
  | "announcements"
  | "staff"
  | "system";

export default function AdminHome({
  onOpen,
  roles,
}: {
  onOpen: (dest: AdminDest) => void;
  roles: string[];
}) {
  const has = (r: string) => roles.includes(r);
  const isAdmin = has("admin");
  const isManager = has("manager");
  const isOperator = has("operator");

  // доступы
  const allowRequests = isOperator || isManager || isAdmin;
  const allowResidents = isManager || isAdmin;
  const allowUnits = isManager || isAdmin;
  const allowAnnouncements = isOperator || isManager || isAdmin;
  const allowStaff = isAdmin; // только админ
  const allowSystem = isAdmin; // только админ

  const items: { key: AdminDest; label: string; icon: any; allow: boolean }[] = [
    { key: "requests", label: "Requests", icon: ClipboardList, allow: allowRequests },
    { key: "residents", label: "Residents", icon: Users, allow: allowResidents },
    { key: "units", label: "Units", icon: Building2, allow: allowUnits },
    { key: "announcements", label: "Announcements", icon: Megaphone, allow: allowAnnouncements },
    { key: "staff", label: "Staff Roles", icon: ShieldCheck, allow: allowStaff },
    { key: "system", label: "System", icon: Settings, allow: allowSystem },
  ];

  const visible = items.filter(i => i.allow);

  return (
    <div>
      <div className="mb-3">
        <div className="text-xl font-semibold tracking-tight">Admin Panel</div>
        <div className="text-sm text-neutral-500">Manage operations & content</div>
      </div>

      <div className="grid grid-cols-2 gap-12">
        {visible.map((i) => (
          <button
            key={i.key}
            className="uv-card p-6 flex flex-col items-center justify-center gap-3 hover:scale-[1.01] transition"
            onClick={() => onOpen(i.key)}
            aria-label={i.label}
          >
            <i.icon size={28} strokeWidth={1.6} />
            <div className="text-sm font-medium">{i.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}