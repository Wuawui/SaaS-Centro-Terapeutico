"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { Save, Palette, Building2, Shield, User, Lock, Eye, EyeOff } from "lucide-react";
import { AvatarUpload } from "@/components/ui/AvatarUpload";

interface TenantData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  plan: string;
}

const colorOptions = [
  { name: "Índigo", value: "#4F46E5" },
  { name: "Azul", value: "#2563EB" },
  { name: "Verde", value: "#059669" },
  { name: "Púrpura", value: "#7C3AED" },
  { name: "Rosa", value: "#DB2777" },
  { name: "Naranja", value: "#EA580C" },
  { name: "Teal", value: "#0D9488" },
];

const planLabels: Record<string, { label: string; color: string; features: string[] }> = {
  basico: { label: "Básico", color: "bg-yellow-50 text-yellow-700 border-yellow-200", features: ["Web + SEO", "Diseño responsivo", "Hosting incluido", "Soporte por WhatsApp", "Subdominio YB gratis"] },
  profesional: { label: "Profesional", color: "bg-blue-50 text-blue-700 border-blue-200", features: ["Todo Básico", "Dominio propio (1er año)", "Pasarela de pagos", "Seguimiento Gmail", "Publicidad Google inicial", "Catálogo autogestionable"] },
  avanzado: { label: "Avanzado", color: "bg-purple-50 text-purple-700 border-purple-200", features: ["Todo Profesional", "3 automatizaciones IA", "Respuestas citas automáticas", "Panel avanzado", "Integración redes", "Reportes mensuales"] },
};

export default function SettingsPage() {
  const supabase = createClient();
  const { profile, user, tenantId, isAdmin: isAdminRole, refreshTenant } = useSession();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"center" | "profile" | "password" | "security">("center");

  const [tenantForm, setTenantForm] = useState({ name: "", slug: "", primary_color: "#4F46E5" });
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", avatar_url: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Profile form is pre-populated from SessionProvider
      if (profile) {
        setProfileForm({
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          phone: profile.phone || "",
          avatar_url: profile.avatar_url || "",
        });
      }

      const { data: tenantData } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
      if (tenantData) {
        setTenant(tenantData);
        setTenantForm({
          name: tenantData.name,
          slug: tenantData.slug,
          primary_color: tenantData.primary_color || "#4F46E5",
        });
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    }
    setLoading(false);
  }, [user?.id, tenantId, profile?.first_name]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSaveTenant() {
    if (!tenant) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/update-tenant", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          id: tenant.id,
          name: tenantForm.name,
          slug: tenantForm.slug,
          primary_color: tenantForm.primary_color,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error actualizando centro");
      } else {
        setSuccess("Centro actualizado");
        await refreshTenant();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Error de red al intentar actualizar");
    }
    setSaving(false);
  }

  async function handleSaveProfile() {
    setProfileSaving(true); setError(null); setSuccess(null);
    if (!user) { setProfileSaving(false); return; }
    const { error: err } = await supabase.from("profiles").update({
      first_name: profileForm.first_name,
      last_name: profileForm.last_name,
      phone: profileForm.phone,
      avatar_url: profileForm.avatar_url || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (err) { setError(err.message); } else {
      setSuccess("Perfil actualizado");
      await refreshTenant();
      setTimeout(() => setSuccess(null), 3000);
    }
    setProfileSaving(false);
  }

  async function handleChangePassword() {
    setError(null); setSuccess(null);
    if (passwordForm.new !== passwordForm.confirm) { setError("Las contraseñas no coinciden"); return; }
    if (passwordForm.new.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    setPasswordSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: passwordForm.new });
    if (err) { setError(err.message); } else {
      setSuccess("Contraseña actualizada");
      setPasswordForm({ current: "", new: "", confirm: "" });
      setTimeout(() => setSuccess(null), 3000);
    }
    setPasswordSaving(false);
  }

  const isAdmin = isAdminRole;
  const currentPlan = planLabels[tenant?.plan || "basico"];
  const tabs = [
    { key: "center", label: "Centro", icon: Building2 },
    { key: "profile", label: "Mi Perfil", icon: User },
    { key: "password", label: "Contraseña", icon: Lock },
    { key: "security", label: "Seguridad", icon: Shield },
  ];

  if (loading) return <PageLoading text="Cargando configuración..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Administra la configuración del centro y tu cuenta</p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">{error}<button onClick={() => setError(null)} className="text-red-500 underline">Cerrar</button></div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      <div className="border-b border-gray-200">
        <nav className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "center" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Información del Centro</h2>
            </div>
            {tenant ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del centro</label>
                  <input type="text" value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} disabled={!isAdmin}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-400 px-2 py-2 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">yinbaoyb.com/</span>
                    <input type="text" value={tenantForm.slug} onChange={e => setTenantForm({...tenantForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")})} disabled={!isAdmin}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500" />
                  </div>
                </div>
                {isAdmin && (
                  <div className="md:col-span-2 flex justify-end">
                    <button onClick={handleSaveTenant} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2">
                      <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">⚠️ No se encontró información del tenant.</p>
              </div>
            )}
          </div>

          {isAdmin && tenant && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <Palette className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Color principal</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map(c => (
                  <button key={c.value} onClick={() => setTenantForm({...tenantForm, primary_color: c.value})}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      tenantForm.primary_color === c.value ? "border-gray-900 ring-2 ring-offset-1 ring-gray-300 shadow-sm" : "border-gray-200 hover:border-gray-300"
                    }`}>
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.value }} /> {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <Shield className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Plan actual</h2>
            </div>
            {currentPlan && (
              <div>
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${currentPlan.color}`}>{currentPlan.label}</span>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentPlan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600"><span className="text-green-500">✓</span> {f}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <User className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Mi Perfil</h2>
          </div>
          <div className="space-y-5">
            <AvatarUpload
              value={profileForm.avatar_url}
              onChange={(val) => setProfileForm({ ...profileForm, avatar_url: val || "" })}
              label="Foto de Perfil Tamaño Carnet"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input type="text" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="tel" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <input type="text" value={profile?.role || ""} disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-500" />
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={handleSaveProfile} disabled={profileSaving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2">
              <Save className="h-4 w-4" /> {profileSaving ? "Guardando..." : "Guardar perfil"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "password" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Lock className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Cambiar Contraseña</h2>
          </div>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <div className="relative">
                <input type={showPassword.new ? "text" : "password"} value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10" />
                <button type="button" onClick={() => setShowPassword({...showPassword, new: !showPassword.new})} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <div className="relative">
                <input type={showPassword.confirm ? "text" : "password"} value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10" />
                <button type="button" onClick={() => setShowPassword({...showPassword, confirm: !showPassword.confirm})} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleChangePassword} disabled={passwordSaving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2">
                <Lock className="h-4 w-4" /> {passwordSaving ? "Actualizando..." : "Cambiar contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Seguridad */}
      {activeTab === "security" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Seguridad</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "Row Level Security (RLS)", desc: "Aislamiento de datos por tenant", status: "Activo" },
              { label: "Autenticación", desc: "Supabase Auth con roles", status: "Activo" },
              { label: "Multi-tenant", desc: "Cada centro completamente aislado", status: "Activo" },
              { label: "Cifrado", desc: "Conexión HTTPS/TLS en todo momento", status: "Activo" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">✓ {item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}