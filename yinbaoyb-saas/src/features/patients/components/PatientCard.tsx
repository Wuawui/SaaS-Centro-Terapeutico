// ============================================================
// PatientCard — Card de paciente reutilizable
// ============================================================

import Link from "next/link";
import { PATIENT_STATUS_CONFIG } from "@/lib/constants";
import { motion } from "framer-motion";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface PatientCardProps {
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
    status: string;
    reason_for_consultation?: string | null;
    date_of_birth?: string | null;
    phone?: string | null;
  };
  href: string;
  accentColor?: string;
  showReason?: boolean;
  showAge?: boolean;
  showPhone?: boolean;
}

export function PatientCard({
  patient: p,
  href,
  accentColor = "bg-indigo-100 text-indigo-600",
  showReason = false,
  showAge = false,
  showPhone = true,
}: PatientCardProps) {
  const status = PATIENT_STATUS_CONFIG[p.status] || { label: p.status, color: "bg-gray-50 text-gray-600" };
  const age = showAge && p.date_of_birth
    ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={href}
        className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all"
      >
      <UserAvatar
        src={p.avatar_url}
        name={`${p.first_name} ${p.last_name}`}
        size="md"
        fallbackGradient="from-teal-500 to-emerald-600"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{p.first_name} {p.last_name}</p>
        {showReason && p.reason_for_consultation && (
          <p className="text-xs text-gray-500 truncate">{p.reason_for_consultation}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {age !== null && <span className="text-xs text-gray-400">{age} años</span>}
          {showPhone && p.phone && <span className="text-xs text-gray-400">· {p.phone}</span>}
        </div>
      </div>
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
        {status.label}
      </span>
    </Link>
    </motion.div>
  );
}
