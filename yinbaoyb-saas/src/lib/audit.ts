// ============================================================
// Módulo de Auditoría y Trazabilidad Médica
// ============================================================
import { createClient } from "@/lib/supabase/client";

export interface AuditEventParams {
  action: "create" | "update" | "delete" | "authorize_edit" | "request_edit" | "sign" | "download";
  entity: "patient" | "clinical_note" | "therapist" | "user" | "appointment";
  entityId?: string;
  details?: Record<string, any>;
}

export async function logAuditEvent(params: AuditEventParams) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, first_name, last_name, role")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) return;

    await supabase.from("audit_log").insert({
      tenant_id: profile.tenant_id,
      user_id: user.id,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId || null,
      details: {
        ...params.details,
        user_name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
        user_role: profile.role,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn("Auditoría médica: el evento no pudo guardarse (tabla audit_log opcional):", err);
  }
}
