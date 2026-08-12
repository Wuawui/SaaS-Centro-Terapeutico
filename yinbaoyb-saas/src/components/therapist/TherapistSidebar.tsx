"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  LogOut,
  Menu,
  X,
  UserCircle,
  Activity,
} from "lucide-react";
import { useState } from "react";

export function TherapistSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    { name: "Mi Dashboard", href: "/therapist", icon: LayoutDashboard },
    { name: "Mis Pacientes", href: "/therapist/patients", icon: Users },
    { name: "Mi Agenda", href: "/therapist/agenda", icon: CalendarDays },
    { name: "Notas Clínicas", href: "/therapist/clinical", icon: ClipboardList },
    { name: "Mi Perfil", href: "/therapist/profile", icon: UserCircle },
  ];

  const navItems = navigation.map((item) => ({
    ...item,
    current:
      item.href === "/therapist"
        ? pathname === "/therapist"
        : pathname.startsWith(item.href),
  }));

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "Cargando...";
  const initials = profile
    ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`
    : "?";

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-teal-900">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white font-bold text-sm">
          CY
        </div>
        <span className="text-white font-semibold text-lg">CentroYB</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              item.current
                ? "bg-teal-800 text-white"
                : "text-teal-200 hover:bg-teal-800/50 hover:text-white"
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Usuario */}
      <div className="border-t border-teal-700 p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-medium">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{displayName}</p>
            <p className="text-xs text-teal-300">Terapeuta</p>
          </div>
          <button
            onClick={signOut}
            className="text-teal-300 hover:text-white"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <SidebarContent />
      </div>

      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-4 bg-white border-b px-4">
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <span className="font-semibold text-lg">CentroYB</span>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}