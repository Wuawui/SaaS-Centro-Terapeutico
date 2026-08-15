"use client";

import { useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { ROLE_LABELS } from "@/lib/constants";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AvatarUpload } from "@/components/ui/AvatarUpload";

export default function TherapistProfilePage() {
  const { profile, user, loading, refreshTenant } = useSession();
  const supabase = createClient();
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading || !profile) {
    return <PageLoading text="Cargando perfil..." color="text-teal-600" />;
  }

  const handlePhotoChange = async (newBase64: string | null) => {
    if (!user) return;
    setSavingPhoto(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: newBase64, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      
      if (error) {
        setMsg("Error al guardar foto: " + error.message);
      } else {
        setMsg("Foto carnet actualizada exitosamente ✓");
        await refreshTenant();
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err: any) {
      setMsg(err.message || "Error al actualizar foto");
    }
    setSavingPhoto(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Información de tu cuenta y credencial profesional</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm font-medium ${msg.includes("Error") ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          {msg}
        </div>
      )}

      {/* Profile card con Foto Carnet */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <UserAvatar
              src={profile.avatar_url}
              name={`${profile.first_name} ${profile.last_name}`}
              size="xl"
              fallbackGradient="from-teal-500 to-emerald-600"
            />
            <div>
              <p className="text-lg font-bold text-gray-900">{profile.first_name} {profile.last_name}</p>
              <p className="text-sm text-teal-600 font-medium">{ROLE_LABELS[profile.role] || "Terapeuta"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
            </div>
          </div>

          <AvatarUpload
            value={profile.avatar_url}
            onChange={handlePhotoChange}
            disabled={savingPhoto}
            label="Actualizar Foto Carnet"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Nombre</p>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{profile.first_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Apellido</p>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{profile.last_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Teléfono</p>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{profile.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Email</p>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{user?.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Rol</p>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{ROLE_LABELS[profile.role] || profile.role}</p>
          </div>
        </div>
      </div>

      {/* Password reset */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Necesitas cambiar algo?</h3>
        <p className="text-sm text-gray-500 mb-4">
          Si necesitas actualizar tu información o cambiar tu contraseña, contacta al administrador del centro terapéutico.
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>📧</span>
          <span>El administrador puede actualizar tus datos desde el panel de administración.</span>
        </div>
      </div>
    </div>
  );
}