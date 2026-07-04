"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

interface TherapistData {
  id: string;
  specialty: string | null;
  license_number: string | null;
  certifications: string[] | null;
  therapeutic_approach: string[] | null;
  max_patients: number | null;
  active: boolean;
  profiles: {
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
  _count?: { patients: number };
}

const approachLabels: Record<string, string> = {
  TCC: "Terapia Cognitivo-Conductual",
  EMDR: "EMDR",
  sistemica: "Terapia Sistémica",
  psicoanalitica: "Psicoanalítica",
  humanista: "Humanista",
  gestalt: "Gestalt",
  integrativa: "Integrativa",
  mindfulness: "Mindfulness",
  arte: "Terapia de Arte",
  juego: "Terapia de Juego",
  familia: "Terapia Familiar",
  pareja: "Terapia de Pareja",
};

export default function TherapistsPage() {
  const supabase = createClient();
  const { user, profile } = useAuth();
  const toast = useToast();
  const [therapists, setTherapists] = useState<TherapistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");

  // Add therapist form
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    password: "",
    specialty: "",
    license_number: "",
    therapeutic_approach: [] as string[],
    max_patients: 20,
  });
  const [approachInput, setApproachInput] = useState("");
  const [customApproachText, setCustomApproachText] = useState("");
  const [emailDomain, setEmailDomain] = useState("gmail.com");

  useEffect(() => { loadTherapists(); }, []);

  useEffect(() => {
    async function loadDomain() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const domain = session.user.email.includes("@") ? session.user.email.split("@")[1] : "gmail.com";
          setEmailDomain(domain);
        }
      } catch (e) {
        console.error("Error loading email domain in therapists page:", e);
      }
    }
    loadDomain();
  }, []);

  async function loadTherapists() {
    setLoading(true);
    setError(null);
    try {
      // Cargar therapists y profiles en PARALELO
      const [therapistsRes, profilesRes] = await Promise.all([
        supabase.from("therapists").select("id, specialty, license_number, certifications, therapeutic_approach, max_patients, active").order("active", { ascending: false }),
        supabase.rpc("get_therapist_profiles"),
      ]);

      if (therapistsRes.error || !therapistsRes.data) {
        setTherapists([]);
        setError(therapistsRes.error?.message || "No se pudieron cargar los datos de los terapeutas.");
        return;
      }

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const combined = therapistsRes.data.map((t: any) => ({
        ...t,
        profiles: profileMap.get(t.id) || null,
      }));

      setTherapists(combined as unknown as TherapistData[]);
    } catch (err: any) {
      console.error("Error fetching therapists:", err);
      setError("Error de red: no se pudo establecer conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  // Get patient count for each therapist
  async function getPatientCount(therapistId: string): Promise<number> {
    const { count } = await supabase
      .from("patients")
      .select("*", { count: "exact", head: true })
      .eq("therapist_id", therapistId)
      .eq("active", true);
    return count || 0;
  }

  const filtered = therapists.filter(t => {
    if (filter === "active" && !t.active) return false;
    if (filter === "inactive" && t.active) return false;
    if (search) {
      const q = search.toLowerCase();
      const p = t.profiles;
      const name = p ? `${p.first_name} ${p.last_name}` : "Terapeuta";
      return name.toLowerCase().includes(q) ||
        (t.specialty || "").toLowerCase().includes(q) ||
        (t.license_number || "").toLowerCase().includes(q);
    }
    return true;
  });

  const handleAddApproach = () => {
    if (approachInput === "custom_option") {
      if (customApproachText.trim() && !form.therapeutic_approach.includes(customApproachText.trim())) {
        setForm({ ...form, therapeutic_approach: [...form.therapeutic_approach, customApproachText.trim()] });
        setCustomApproachText("");
        setApproachInput("");
      }
    } else if (approachInput && !form.therapeutic_approach.includes(approachInput)) {
      setForm({ ...form, therapeutic_approach: [...form.therapeutic_approach, approachInput] });
      setApproachInput("");
    }
  };

  const handleRemoveApproach = (approach: string) => {
    setForm({ ...form, therapeutic_approach: form.therapeutic_approach.filter(a => a !== approach) });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Get current user's access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("No autenticado");
        setSaving(false);
        return;
      }

      // Create user via admin API with custom domain suffix
      const finalEmail = form.email.includes("@") ? form.email.trim() : `${form.email.trim()}@${emailDomain}`;

      // Create user via admin API (uses service_role internally)
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: finalEmail,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || undefined,
          role: "terapeuta",
          tenant_id: profile?.tenant_id || (await getTenantId()),
          specialty: form.specialty || undefined,
          license_number: form.license_number || undefined,
          therapeutic_approach: form.therapeutic_approach.length > 0 ? form.therapeutic_approach : undefined,
          max_patients: form.max_patients,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Error creando usuario");
        setSaving(false);
        return;
      }

      setShowAddForm(false);
      setForm({ first_name: "", last_name: "", phone: "", email: "", password: "", specialty: "", license_number: "", therapeutic_approach: [], max_patients: 20 });
      loadTherapists();
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  async function getTenantId(): Promise<string> {
    // Del hook useAuth (cargado en paralelo con la página)
    if (profile?.tenant_id) return profile.tenant_id;
    // Hardcode: único tenant existente
    return "00000000-0000-0000-0000-000000000001";
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error: err } = await supabase.from("therapists").update({ active: !currentActive }).eq("id", id);
    if (err) { toast.addToast("Error: " + err.message, "error"); return; }
    // Also toggle profile active
    await supabase.from("profiles").update({ active: !currentActive }).eq("id", id);
    loadTherapists();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás completamente seguro de ELIMINAR a ${name}?\n\nEsta acción es irreversible y borrará su acceso y cuenta. Si el terapeuta tiene pacientes asignados o notas en el historial, la base de datos bloqueará esta acción por seguridad médica.`)) {
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/delete-user?id=${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Error al eliminar");
        window.scrollTo(0, 0);
      } else {
        toast.addToast("Terapeuta eliminado definitivamente", "success");
        loadTherapists();
      }
    } catch (err: any) {
      setError("Error de red al intentar eliminar");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }

  const activeCount = therapists.filter(t => t.active).length;
  const inactiveCount = therapists.filter(t => !t.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Terapeutas</h1>
          <p className="text-sm text-gray-500 mt-1">{activeCount} activo{activeCount !== 1 ? "s" : ""} · {inactiveCount} inactivo{inactiveCount !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 inline-flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo Terapeuta
        </button>
      </div>

      {/* General error */}
      {error && !showAddForm && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 underline">Cerrar</button>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Nuevo Terapeuta</h2>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label><input required value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Ana" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label><input required value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="García López" /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <div className="relative flex rounded-lg shadow-sm">
                <input 
                  type="text" 
                  required 
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  className="block w-full pl-3 pr-32 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none" 
                  placeholder="ej: ana" 
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 select-none">
                    @{emailDomain}
                  </span>
                </div>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label><input type="password" required minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Mínimo 6 caracteres" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="+593 99 999 9999" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Especialidad</label><input value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Psicología Clínica" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Número de licencia</label><input value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="PSI-XXXX" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Máximo de pacientes</label><input type="number" min={1} max={100} value={form.max_patients} onChange={e => setForm({...form, max_patients: parseInt(e.target.value) || 20})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
            {/* Therapeutic approach */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Enfoque terapéutico</label>
              <div className="flex gap-2 mb-2">
                <select value={approachInput} onChange={e => { setApproachInput(e.target.value); if (e.target.value !== "custom_option") setCustomApproachText(""); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  <option value="">Seleccionar...</option>
                  {Object.entries(approachLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  <option value="custom_option">Otro (escribir propio)...</option>
                </select>
                <button type="button" onClick={handleAddApproach} className="px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">Agregar</button>
              </div>
              {approachInput === "custom_option" && (
                <div className="mb-3">
                  <input 
                    type="text" 
                    value={customApproachText} 
                    onChange={e => setCustomApproachText(e.target.value)} 
                    placeholder="Escribe tu propio enfoque..." 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                  />
                </div>
              )}
              {form.therapeutic_approach.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.therapeutic_approach.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {approachLabels[a] || a}
                      <button type="button" onClick={() => handleRemoveApproach(a)} className="text-indigo-400 hover:text-indigo-700">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Creando..." : "Crear Terapeuta"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex bg-gray-100 rounded-lg p-0.5 min-w-max">
            {(["all", "active", "inactive"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${filter === f ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {f === "all" ? `Todos (${therapists.length})` : f === "active" ? `Activos (${activeCount})` : `Inactivos (${inactiveCount})`}
              </button>
            ))}
          </div>
        </div>
        <input type="text" placeholder="Buscar por nombre, especialidad..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
      </div>

      {/* Therapist list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">👩‍⚕️</div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {therapists.length === 0 ? "Sin terapeutas registrados" : "Sin resultados"}
          </h3>
          <p className="text-sm text-gray-500">
            {therapists.length === 0 ? "Agrega el primer terapeuta al equipo" : "Intenta con otro filtro"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const p = t.profiles;
            const name = p ? `${p.first_name} ${p.last_name}` : "Terapeuta sin perfil";
            const initials = p ? `${p.first_name[0] || ""}${p.last_name[0] || ""}` : "T";
            const approaches = (t.therapeutic_approach || []).map(a => approachLabels[a] || a);
            return (
              <Link
                key={t.id}
                href={`/therapists/${t.id}`}
                className={`block bg-white rounded-2xl border p-4 transition-all duration-200 hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 group ${
                  t.active ? "border-gray-200" : "border-gray-200 opacity-70"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm ${
                    t.active ? "bg-gradient-to-br from-indigo-500 to-purple-600" : "bg-gray-400"
                  }`}>
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${t.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {t.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {t.specialty && <span>{t.specialty}</span>}
                      {t.specialty && p?.email && <span>·</span>}
                      {p?.email && <span className="truncate">{p.email}</span>}
                    </div>
                    {approaches.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {approaches.slice(0, 3).map(a => (
                          <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">{a}</span>
                        ))}
                        {approaches.length > 3 && <span className="text-[10px] text-gray-400">+{approaches.length - 3}</span>}
                      </div>
                    )}
                  </div>

                  <svg className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}