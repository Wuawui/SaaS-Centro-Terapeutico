import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    
    if (!patientId) {
      return NextResponse.json({ error: "Falta el ID del paciente" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("physical_therapy_sessions")
      .select("*, profiles!physical_therapy_sessions_therapist_id_fkey(first_name, last_name)")
      .eq("patient_id", patientId)
      .order("session_number", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profErr || !prof) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { 
      historyId,
      patientId,
      sessionNumber,
      treatmentApplied,
      painLevelEva,
      painLevelBeforeEva,
      painLevelAfterEva,
      observations
    } = body;

    if (!patientId || !historyId || !treatmentApplied) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("physical_therapy_sessions")
      .insert({
        tenant_id: prof.tenant_id,
        history_id: historyId,
        patient_id: patientId,
        therapist_id: user.id,
        session_number: sessionNumber || 1,
        treatment_applied: treatmentApplied,
        pain_level_eva: painLevelEva !== undefined ? painLevelEva : (painLevelAfterEva || 0),
        pain_level_before_eva: painLevelBeforeEva || 0,
        pain_level_after_eva: painLevelAfterEva || 0,
        observations: observations || ""
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
