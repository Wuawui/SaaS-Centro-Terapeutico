"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackGradient?: string;
}

export function UserAvatar({
  src,
  name = "Usuario",
  size = "md",
  className = "",
  fallbackGradient = "from-indigo-500 to-indigo-700",
}: UserAvatarProps) {
  const sizeClasses = {
    xs: "w-7 h-7 text-[10px]",
    sm: "w-9 h-9 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-xl",
  }[size];

  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          `${sizeClasses} rounded-2xl object-cover border border-slate-200/80 shadow-xs ring-1 ring-black/5 bg-slate-50 flex-shrink-0`,
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        `${sizeClasses} rounded-2xl bg-gradient-to-br ${fallbackGradient} text-white font-bold flex items-center justify-center shadow-xs flex-shrink-0 select-none`,
        className
      )}
    >
      {initials}
    </div>
  );
}
