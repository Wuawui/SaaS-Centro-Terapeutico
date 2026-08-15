"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/SessionProvider";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ROLE_LABELS,
  COLOR_SCHEMES,
  type NavItem,
  type ColorScheme,
} from "@/lib/constants";

import { UserAvatar } from "@/components/ui/UserAvatar";

// ============================================================
// Sidebar Unificado — Reemplaza Sidebar.tsx + TherapistSidebar.tsx
// + inline sidebar de ParentLayout
// Configurable por props: items, color, brand
// ============================================================

interface SidebarProps {
  navItems: NavItem[];
  colorScheme?: ColorScheme;
  brand?: { name: string; initials: string };
}

export function Sidebar({
  navItems,
  colorScheme = "indigo",
}: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut, tenantName, tenantInitials, tenantColor } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = COLOR_SCHEMES[colorScheme];

  // Dynamic branding fallback
  const finalBrandName = tenantName || "CentroYB";
  const finalBrandInitials = tenantInitials || "YB";
  const finalBrandColor = tenantColor || "#4F46E5";

  // Filter nav items by role if roles are specified
  const filteredNav = navItems.filter(
    (item) => !item.roles || !profile?.role || item.roles.includes(profile.role)
  );

  const items = filteredNav.map((item) => ({
    ...item,
    current:
      pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/therapist" &&
        item.href !== "/parent" &&
        pathname.startsWith(item.href)),
  }));

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "Cargando...";
  const initials = profile
    ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`
    : "?";
  const roleLabel = profile ? ROLE_LABELS[profile.role] || profile.role : "";

  const SidebarContent = () => (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "circOut" }}
      className="flex h-full flex-col bg-white/60 backdrop-blur-3xl border border-slate-200/50 rounded-3xl shadow-glass overflow-hidden transition-all duration-300"
    >
      {/* Soft Top Glow */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="flex h-20 items-center justify-center gap-3 px-6 relative z-10">
        <div 
          className="flex h-10 w-10 items-center justify-center rounded-[14px] text-white font-bold tracking-tight shadow-md"
          style={{ background: `linear-gradient(135deg, ${finalBrandColor}, ${finalBrandColor}dd)` }}
        >
          {finalBrandInitials}
        </div>
        <span className="text-slate-800 font-extrabold text-xl tracking-tight font-[family-name:var(--font-outfit)]">{finalBrandName}</span>
      </div>

      {/* Navigation — grouped by section */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto relative z-10 custom-scrollbar">
        {(() => {
          // Group items by section
          const sections: { label: string; items: typeof items }[] = [];
          let currentSection = "";
          items.forEach((item) => {
            const sectionLabel = item.section || "";
            if (sectionLabel !== currentSection) {
              currentSection = sectionLabel;
              sections.push({ label: sectionLabel, items: [item] });
            } else {
              sections[sections.length - 1].items.push(item);
            }
          });

          return sections.map((section, sIdx) => (
            <div key={section.label || sIdx} className={sIdx > 0 ? "mt-5" : ""}>
              {/* Section header */}
              {section.label && (
                <div className="px-4 mb-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400/80">
                    {section.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-200/50" />
                </div>
              )}
              {/* Section items */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.current;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={true}
                      data-tour={`sidebar-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "group flex items-center gap-3.5 rounded-[1.125rem] px-4 py-2.5 text-[13.5px] font-medium transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                        isActive
                          ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-slate-100"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/80"
                      )}
                      style={isActive ? { color: finalBrandColor } : {}}
                    >
                      <item.icon
                        className={cn(
                          "h-[1.15rem] w-[1.15rem] transition-transform duration-300",
                          isActive
                            ? "drop-shadow-sm scale-110"
                            : "text-slate-400 group-hover:text-slate-600"
                        )}
                        style={isActive ? { color: finalBrandColor } : {}}
                      />
                      <span className="tracking-wide">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </nav>

      {/* User profile */}
      <div className="p-4 relative z-10">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/70 shadow-sm border border-slate-100 hover:bg-white transition-colors">
          <UserAvatar
            src={profile?.avatar_url}
            name={displayName}
            size="sm"
            fallbackGradient="from-teal-500 to-emerald-600"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800 truncate">{displayName}</p>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{roleLabel}</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Cerrar sesión"
          >
            <LogOut className="h-[1.15rem] w-[1.15rem]" />
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:p-4 lg:pr-0">
        <SidebarContent />
      </div>

      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-16 items-center gap-4 bg-white/70 backdrop-blur-md border-b border-slate-200/50 px-4">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
          {mobileOpen ? <X className="h-5 w-5 text-slate-700" /> : <Menu className="h-5 w-5 text-slate-700" />}
        </button>
        <span className="font-extrabold text-lg text-slate-800 font-[family-name:var(--font-outfit)]">{finalBrandName}</span>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 p-2">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}