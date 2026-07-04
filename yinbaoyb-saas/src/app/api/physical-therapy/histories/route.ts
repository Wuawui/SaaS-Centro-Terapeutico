import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const id = searchParams.get("id");
    
    if (!patientId && !id) {
      return NextResponse.json({ error: "Faltan parámetros de búsqueda (patientId o id)" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let query = supabase
      .from("physical_therapy_histories")
      .select("*, profiles!physical_therapy_histories_therapist_id_fkey(first_name, last_name)");

    if (id) {
      const { data, error } = await query.eq("id", id).single();
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      const { data, error } = await query
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json(data || []);
    }
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
      patientId,
      identificationData,
      physicalMeasures,
      explorationGeneral,
      explorationStructural,
      gaitAnalysis,
      articularEvaluation,
      muscularEvaluation,
      neurologicalEvaluation,
      treatmentPlan 
    } = body;

    if (!patientId) {
      return NextResponse.json({ error: "Falta el ID del paciente" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("physical_therapy_histories")
      .insert({
        tenant_id: prof.tenant_id,
        patient_id: patientId,
        therapist_id: user.id,
        identification_data: identificationData || {},
        physical_measures: physicalMeasures || {},
        exploration_general: explorationGeneral || {},
        exploration_structural: explorationStructural || {},
        gait_analysis: gaitAnalysis || {},
        articular_evaluation: articularEvaluation || {},
        muscular_evaluation: muscularEvaluation || {},
        neurological_evaluation: neurologicalEvaluation || {},
        treatment_plan: treatmentPlan || {}
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      id,
      identificationData,
      physicalMeasures,
      explorationGeneral,
      explorationStructural,
      gaitAnalysis,
      articularEvaluation,
      muscularEvaluation,
      neurologicalEvaluation,
      treatmentPlan 
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Falta el ID del historial" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("physical_therapy_histories")
      .update({
        identification_data: identificationData,
        physical_measures: physicalMeasures,
        exploration_general: explorationGeneral,
        exploration_structural: explorationStructural,
        gait_analysis: gaitAnalysis,
        articular_evaluation: articularEvaluation,
        muscular_evaluation: muscularEvaluation,
        neurological_evaluation: neurologicalEvaluation,
        treatment_plan: treatmentPlan,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
