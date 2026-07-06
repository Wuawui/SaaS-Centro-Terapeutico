"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  primary_diagnosis: string | null;
  primary_diagnosis_desc: string | null;
  status: string;
  active: boolean | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  activo: { label: "Activo", color: "bg-green-50 text-green-700" },
  alta: { label: "Alta", color: "bg-blue-50 text-blue-700" },
  abandonado: { label: "Abandonó", color: "bg-red-50 text-red-700" },
  lista_espera: { label: "En espera", color: "bg-yellow-50 text-yellow-700" },
};

export default function PatientTable({ initialPatients }: { initialPatients: Patient[] }) {
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const filtered = search
    ? patients.filter((p) => {
        const q = search.toLowerCase();
        return (
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.document_number || "").toLowerCase().includes(q) ||
          (p.primary_diagnosis_desc || p.primary_diagnosis || "").toLowerCase().includes(q)
        );
      })
    : patients;

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    const { error } = await supabase
      .from("patients")
      .update({ active: !currentActive })
      .eq("id", id);

    if (!error) {
      setPatients(patients.map((p) => (p.id === id ? { ...p, active: !currentActive } : p)));
      router.refresh();
    }
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    alert("Por políticas de conservación de datos clínicos (Cero Pérdida), los pacientes no pueden ser eliminados permanentemente del sistema. Por favor, use la opción de 'Desactivar' (icono de bloqueo) para archivar al paciente de forma segura sin perder su historial.");
    setConfirmDelete(null);
  };

  if (patients.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No hay pacientes aún
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Crea el primer paciente para comenzar a usar el sistema
        </p>
        <Link
          href="/patients/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear Paciente
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Buscar por nombre, documento o diagnóstico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diagnóstico</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((patient) => {
                const status = statusConfig[patient.status] || { label: patient.status, color: "bg-gray-50 text-gray-700" };
                const isInactive = patient.active === false;
                return (
                  <tr key={patient.id} className={`hover:bg-gray-50 ${isInactive ? "opacity-60" : ""}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/patients/${patient.id}`} className="hover:text-indigo-600">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {patient.first_name} {patient.last_name}
                          {isInactive && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Inactivo</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{patient.email}</div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.document_number || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.primary_diagnosis_desc || patient.primary_diagnosis || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.phone || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/patients/${patient.id}`}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(patient.created_at).toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle activo/inactivo */}
                        <button
                          onClick={() => handleToggleActive(patient.id, patient.active !== false)}
                          disabled={togglingId === patient.id}
                          title={isInactive ? "Activar paciente" : "Desactivar paciente"}
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            isInactive
                              ? "text-green-600 hover:bg-green-50"
                              : "text-orange-600 hover:bg-orange-50"
                          } disabled:opacity-50`}
                        >
                          {togglingId === patient.id ? (
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : isInactive ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          )}
                        </button>
                        {/* Editar */}
                        <Link
                          href={`/patients/${patient.id}`}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 text-xs"
                          title="Ver / Editar"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        {/* Eliminar */}
                        {confirmDelete === patient.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(patient.id)}
                              className="p-1.5 rounded-lg bg-red-600 text-white text-xs"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="p-1.5 rounded-lg text-gray-600 bg-gray-100 text-xs"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(patient.id)}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs"
                            title="Eliminar paciente"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}