"use client";

import React, { useRef, useState } from "react";
import { Camera, Trash2, User, Loader2 } from "lucide-react";
import { processCarnetPhoto } from "@/lib/image-utils";

interface AvatarUploadProps {
  value?: string | null;
  onChange: (base64Url: string | null) => void;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  disabled?: boolean;
}

export function AvatarUpload({
  value,
  onChange,
  name = "Foto de perfil",
  size = "lg",
  label = "Foto tamaño carnet",
  disabled = false,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const sizeClasses = {
    sm: "w-14 h-14 text-sm",
    md: "w-20 h-20 text-base",
    lg: "w-28 h-28 text-xl",
    xl: "w-36 h-36 text-2xl",
  }[size];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido (JPG, PNG o WebP).");
      return;
    }

    try {
      setProcessing(true);
      const carnetBase64 = await processCarnetPhoto(file, {
        maxWidth: 360,
        maxHeight: 360,
        quality: 0.88,
      });
      onChange(carnetBase64);
    } catch (err: any) {
      alert(err.message || "Error al procesar la foto tamaño carnet");
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="flex flex-col items-center sm:items-start gap-2">
      {label && <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</label>}
      <div className="flex items-center gap-4">
        <div
          onClick={() => !disabled && !processing && fileInputRef.current?.click()}
          className={`relative ${sizeClasses} rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 flex items-center justify-center overflow-hidden cursor-pointer group transition-all shadow-sm ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
          title="Haz clic para subir o cambiar foto tamaño carnet"
        >
          {value ? (
            <img
              src={value}
              alt={name}
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-indigo-400 group-hover:text-indigo-600">
              <User className="w-8 h-8 opacity-60" />
              <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">Subir Foto</span>
            </div>
          )}

          {/* Overlay hover */}
          {!disabled && (
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
              <Camera className="w-6 h-6 text-white" />
            </div>
          )}

          {/* Loading spinner */}
          {processing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center rounded-2xl">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-1 text-left">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp, image/jpg"
            onChange={handleFileChange}
            disabled={disabled || processing}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || processing}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            {value ? "Cambiar foto" : "Cargar carnet"}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          )}
          <p className="text-[10px] text-slate-400">JPG, PNG o WebP (Ajuste carnet automático)</p>
        </div>
      </div>
    </div>
  );
}
