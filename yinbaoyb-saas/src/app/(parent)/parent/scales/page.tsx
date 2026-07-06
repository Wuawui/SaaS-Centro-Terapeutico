"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ParentScalesPage() {
  const supabase = createClient();
  const [scales, setScales] = useState<any[]>([]);
  const [scaleInfo, setScaleInfo] = useState<Map<string, any>>(new Map());
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const previewFile = (fileObj: any) => {
    if (fileObj.file_data && fileObj.file_data.startsWith("data:application/pdf")) {
      setPreviewUrl(fileObj.file_data);
      setPreviewName(fileObj.file_name);
    } else {
      alert("La previsualización está disponible únicamente para archivos PDF");
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get linked patient IDs
      const { data: parentLinks } = await supabase
        .from("parent_patients")
        .select("patient_id, can_view_scales")
        .eq("parent_id", user.id);

      if (parentLinks && parentLinks.length > 0) {
        const patientIds = parentLinks.map((pl: any) => pl.patient_id);
        
        // Fetch scales results
        const { data: scalesRes, error: rpcErr } = await supabase.rpc("get_parent_scales", { p_parent_id: user.id });
        if (rpcErr) { setError(rpcErr.message); setLoading(false); return; }
        setScales(scalesRes || []);

        if (scalesRes && scalesRes.length > 0) {
          const scaleIds = [...new Set(scalesRes.map((s: any) => s.scale_id))];
          const { data: infoData } = await supabase.from("clinical_scales").select("id, name, acronym, max_score, risk_threshold").in("id", scaleIds);
          setScaleInfo(new Map((infoData || []).map((s: any) => [s.id, s])));
        }

        // Fetch document evaluations from clinical_notes (only if parent has scale viewing rights)
        const canViewScales = parentLinks.some((pl: any) => pl.can_view_scales);
        if (canViewScales) {
          const { data: notesData } = await supabase
            .from("clinical_notes")
            .select("id, content, created_at")
            .in("patient_id", patientIds)
            .order("created_at", { ascending: false });

          if (notesData) {
            const evals = notesData
              .filter((n: any) => n.content?.trim().startsWith('{"type":"evaluacion"') || n.content?.trim().startsWith('{"type":"informe"'))
              .map((n: any) => {
                try {
                  const parsed = JSON.parse(n.content);
                  return { id: n.id, created_at: n.created_at, ...parsed };
                } catch (e) {
                  return null;
                }
              })
              .filter((n: any) => n && n.shared === true);

            setEvaluations(evals);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Error cargando evaluaciones");
    }
    setLoading(false);
  }, []);

  const downloadFile = (fileObj: any) => {
    try {
      const link = document.createElement("a");
      link.href = fileObj.file_data;
      link.download = fileObj.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Error al descargar el archivo");
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  const getRiskEmoji = (score: number, max: number) => {
    const pct = max ? (score / max) * 100 : 0;
    if (pct >= 70) return { emoji: "🔴", label: "Riesgo alto", color: "text-red-600", bg: "bg-red-50" };
    if (pct >= 40) return { emoji: "🟡", label: "Riesgo moderado", color: "text-yellow-600", bg: "bg-yellow-50" };
    return { emoji: "🟢", label: "Bajo riesgo", color: "text-green-600", bg: "bg-green-50" };
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin h-6 w-6 border-4 border-emerald-600 border-t-transparent rounded-full" /></div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 font-outfit">📊 Evaluaciones</h1>

      {/* Documentos de Evaluación Compartidos */}
      {evaluations.length > 0 && (
        <div className="space-y-3 bg-white p-5 rounded-xl border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <span>📁</span> Informes y Evaluaciones Clínicas Compartidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluations.map(item => {
              const formattedSize = item.file_size ? `${(item.file_size / 1024).toFixed(1)} KB` : "N/A";
              const isPdf = item.file_name?.toLowerCase().endsWith(".pdf");

              return (
                <div key={item.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                      {isPdf ? "PDF" : "DOC"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.file_name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleDateString("es-EC")} · {formattedSize}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => previewFile(item)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm cursor-pointer active:scale-95"
                    >
                      Previsualizar
                    </button>
                    <button
                      onClick={() => downloadFile(item)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-emerald-600 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm cursor-pointer active:scale-95"
                    >
                      Descargar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {scales.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500">Aún no hay escalas clínicas registradas</p>
        </div>
      ) : (
        <>
          {scales.length >= 2 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Evolución en Escalas</h3>
              <div className="flex items-end gap-2 h-24">
                {[...scales].reverse().slice(0, 8).map((s, i) => {
                  const info = scaleInfo.get(s.scale_id);
                  const max = info?.max_score || 27;
                  const pct = max ? (s.total_score / max) * 100 : 0;
                  const risk = getRiskEmoji(s.total_score, max);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full rounded-t ${risk.emoji === "🔴" ? "bg-red-400" : risk.emoji === "🟡" ? "bg-yellow-400" : "bg-green-400"}`} style={{ height: `${Math.max(pct, 10)}%` }} />
                      <span className="text-[9px] text-gray-400">{new Date(s.completed_at).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span>📊</span> Historial de Escalas Aplicadas
            </h2>
            {scales.map(s => {
              const info = scaleInfo.get(s.scale_id);
              const max = info?.max_score || 27;
              const risk = getRiskEmoji(s.total_score, max);
              return (
                <div key={s.id} className={`rounded-xl border p-4 ${s.risk_alert ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{info?.acronym || "Escala"}</span>
                      <span className="text-xs text-gray-500 ml-2">{info?.name}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-2xl font-bold ${risk.color}`}>{s.total_score}</span>
                      <span className="text-sm text-gray-400">/{max}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${risk.emoji === "🔴" ? "bg-red-500" : risk.emoji === "🟡" ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(max ? (s.total_score / max) * 100 : 0, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium ${risk.color}`}>{risk.emoji} {risk.label}</span>
                    <span className="text-xs text-gray-400">{new Date(s.completed_at).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  {s.notes && <p className="text-xs text-gray-500 mt-1 italic">"{s.notes}"</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="text-xs text-gray-400 text-center">Solo lectura · Las evaluaciones son aplicadas por el terapeuta</p>

      {/* Modal de Previsualización de PDF */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <h3 className="font-semibold text-gray-900 text-base md:text-lg truncate max-w-md md:max-w-xl text-left">{previewName}</h3>
              </div>
              <button 
                onClick={() => { setPreviewUrl(null); setPreviewName(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Iframe */}
            <div className="flex-1 bg-gray-100 relative">
              <iframe 
                src={previewUrl} 
                className="w-full h-full border-0" 
                title="Vista previa de documento"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}