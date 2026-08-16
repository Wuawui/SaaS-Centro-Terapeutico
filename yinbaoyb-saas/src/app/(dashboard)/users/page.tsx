"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface UserData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  avatar_url?: string | null;
  active: boolean;
}

const roleLabels = ROLE_LABELS;
const roleColors = ROLE_COLORS;

export default function UsersPage() {
  const supabase = createClient();
  const { tenantId } = useSession();
  const toast = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
    role: "padre",
    avatar_url: "",
  });

  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    password: "",
    phone: "",
    role: "padre",
    avatar_url: "",
    active: true,
  });

  const handleEditClick = (u: UserData) => {
    setEditForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      password: "", // Contraseña siempre en blanco para no sobreescribirla por accidente
      phone: u.phone || "",
      role: u.role || "padre",
      avatar_url: u.avatar_url || "",
      active: u.active !== false,
    });
    setEditingUser(u);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/users", {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      
      const data = await res.json();
      
      if (res.ok && data.users) {
        setUsers(data.users);
      } else {
        // Fallback básico si la API falla
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, phone, role, active")
          .order("role");
          
        if (profilesData) {
          setUsers(profilesData.map((p: any) => ({ ...p, email: null })));
        }
      }
    } catch (err) {
      console.error("Error loading users", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("No autenticado"); setSaving(false); return; }

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, tenant_id: tenantId || "00000000-0000-0000-0000-000000000001" }),
      });

      const result = await res.json();
      if (!res.ok) { setError(result.error || "Error creando usuario"); setSaving(false); return; }

      setShowAddForm(false);
      setForm({ first_name: "", last_name: "", email: "", password: "", phone: "", role: "padre", avatar_url: "" });
      loadUsers();
      toast.addToast("Usuario creado con éxito", "success");
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("No autenticado"); setSaving(false); return; }

      const res = await fetch("/api/admin/update-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          id: editingUser.id,
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          phone: editForm.phone,
          role: editForm.role,
          active: editForm.active,
          avatar_url: editForm.avatar_url || null,
          password: editForm.password, // Only processed if not empty
        }),
      });

      const result = await res.json();
      if (!res.ok) { setError(result.error || "Error actualizando usuario"); setSaving(false); return; }

      setEditingUser(null);
      loadUsers();
      toast.addToast("Usuario modificado con éxito", "success");
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás completamente seguro de ELIMINAR a ${name}?\n\nEsta acción es irreversible y borrará su acceso y cuenta permanentemente.`)) {
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
        setError(data.error || "Error al eliminar usuario");
        window.scrollTo(0, 0);
      } else {
        toast.addToast("Usuario eliminado definitivamente", "success");
        loadUsers();
      }
    } catch (err: any) {
      setError("Error de red al intentar eliminar");
    }
    setLoading(false);
  };

  const filtered = users.filter(u => {
    if (filter !== "all" && u.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona terapeutas, padres y personal del centro</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 inline-flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo Usuario
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}<button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button></div>}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Nuevo Usuario</h2>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <AvatarUpload
                value={form.avatar_url}
                onChange={(val) => setForm({ ...form, avatar_url: val || "" })}
                label="Foto tamaño carnet (Opcional)"
              />
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label><input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="paciente">👶 Niños (Pacientes de Terapias)</option>
                <option value="padre">👨‍👩‍👧 Padre/Acudiente</option>
                <option value="terapeuta">👩‍⚕️ Terapeuta (Integral / Atención Temprana)</option>
                <option value="fisioterapeuta">🏃 Fisioterapeuta (Terapia Física)</option>
                <option value="coordinador">📋 Coordinador/a Clínico</option>
                <option value="director">👔 Director/a de Sede</option>
                <option value="admin">🛡️ Administrador del Sistema</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Creando..." : "Crear Usuario"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex bg-gray-100 rounded-lg p-0.5 min-w-max">
            {(["all", "paciente", "padre", "terapeuta", "fisioterapeuta", "coordinador", "director", "admin"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${filter === f ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {f === "all" ? `Todos (${users.length})` : roleLabels[f] || f}
              </button>
            ))}
          </div>
        </div>
        <input type="text" placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
      </div>

      {/* Users list */}
      {loading ? (
        <PageLoading text="Cargando usuarios..." />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Sin usuarios</h3>
          <p className="text-sm text-gray-500">Crea el primer usuario haciendo clic en &quot;Nuevo Usuario&quot;</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(u => {
                const name = `${u.first_name || ""} ${u.last_name || ""}`;
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 flex items-center gap-3">
                      <UserAvatar src={u.avatar_url} name={name} size="sm" />
                      <span>{name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.email || "—"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role] || "bg-gray-50 text-gray-600"}`}>{roleLabels[u.role] || u.role}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.phone || "—"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.active !== false ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{u.active !== false ? "Activo" : "Inactivo"}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditClick(u)} 
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" 
                          title="Editar usuario"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button 
                          onClick={() => setSelectedUser(u)} 
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors" 
                          title="Ver información"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(u.id, name)} 
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" 
                          title="Eliminar definitivamente"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Información del Usuario</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-100 rounded-full p-1.5 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <UserAvatar
                  src={selectedUser.avatar_url}
                  name={`${selectedUser.first_name} ${selectedUser.last_name}`}
                  size="xl"
                />
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{selectedUser.first_name} {selectedUser.last_name}</h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${roleColors[selectedUser.role] || "bg-gray-100 text-gray-700"}`}>
                    {roleLabels[selectedUser.role] || selectedUser.role}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
                  <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded-lg">{selectedUser.email || "No registrado"}</p>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Teléfono</label>
                  <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded-lg">{selectedUser.phone || "No registrado"}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Estado de la cuenta</label>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium ${selectedUser.active !== false ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedUser.active !== false ? "bg-green-500" : "bg-gray-400"}`}></span>
                      {selectedUser.active !== false ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">ID Sistema</label>
                    <p className="text-xs font-mono text-gray-500 bg-gray-50 p-2 rounded-lg truncate" title={selectedUser.id}>{selectedUser.id.split('-')[0] + '...'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setSelectedUser(null)} className="px-5 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Form Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Editar Usuario - {editingUser.email}</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-100 rounded-full p-1.5 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <AvatarUpload
                    value={editForm.avatar_url}
                    onChange={(val) => setEditForm({ ...editForm, avatar_url: val || "" })}
                    label="Actualizar foto tamaño carnet"
                  />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label><input value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <option value="paciente">👶 Niños (Pacientes de Terapias)</option>
                    <option value="padre">👨‍👩‍👧 Padre/Acudiente</option>
                    <option value="terapeuta">👩‍⚕️ Terapeuta (Integral / Atención Temprana)</option>
                    <option value="fisioterapeuta">🏃 Fisioterapeuta (Terapia Física)</option>
                    <option value="coordinador">📋 Coordinador/a Clínico</option>
                    <option value="director">👔 Director/a de Sede</option>
                    <option value="admin">🛡️ Administrador del Sistema</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={editForm.active ? "true" : "false"} onChange={e => setEditForm({...editForm, active: e.target.value === "true"})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <option value="true">✅ Activo</option>
                    <option value="false">❌ Inactivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="Dejar en blanco para no cambiar" minLength={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none tracking-wide">{saving ? "Guardando..." : "Guardar Cambios"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}