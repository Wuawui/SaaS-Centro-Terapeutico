import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const authHeader = request.headers.get("authorization");
  const userToken = authHeader?.replace("Bearer ", "");

  if (!userToken) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar admin
  const adminRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${userToken}`, apikey: anonKey },
  });
  const adminData = await adminRes.json();
  if (!adminData.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar rol
  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${adminData.id}&select=role,tenant_id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` },
  });
  const profiles = await profileRes.json();
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: "Sin perfil" }, { status: 403 });
  }

  const userProfile = profiles[0];
  const allowedRoles = ["super_admin", "director", "admin", "coordinador"];
  if (!allowedRoles.includes(userProfile.role)) {
    return NextResponse.json({ error: "No tienes permisos para ver usuarios" }, { status: 403 });
  }

  try {
    const fetchHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // 1. Obtener todos los perfiles del tenant actual
    const allProfilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?tenant_id=eq.${userProfile.tenant_id}&select=id,first_name,last_name,phone,role,active,avatar_url,tenant_id&order=role.asc`, {
      headers: fetchHeaders,
    });
    const allProfiles = (await allProfilesRes.json()) || [];

    // 2. Obtener terapeutas para saber la especialidad
    const allTherapistsRes = await fetch(`${supabaseUrl}/rest/v1/therapists?select=id,specialty,active`, {
      headers: fetchHeaders,
    });
    const allTherapists = (await allTherapistsRes.json()) || [];
    const therapistMap = new Map<string, string>(
      (Array.isArray(allTherapists) ? allTherapists : []).map((t: any) => [t.id, t.specialty || ""])
    );

    // 3. Obtener todos los pacientes registrados de la tabla patients (avatar guardado en emergency_contact)
    const allPatientsRes = await fetch(`${supabaseUrl}/rest/v1/patients?tenant_id=eq.${userProfile.tenant_id}&select=id,first_name,last_name,phone,email,active,emergency_contact&order=created_at.desc`, {
      headers: fetchHeaders,
    });
    const allPatients = (await allPatientsRes.json()) || [];

    // 4. Obtener usuarios de Auth
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: fetchHeaders,
    });
    const authData = await authRes.json();
    const authUsers = authData.users || [];

    // Mapear perfiles
    const combinedProfiles = (Array.isArray(allProfiles) ? allProfiles : []).map((p: any) => {
      const u = authUsers.find((user: any) => user.id === p.id);
      const specialty = therapistMap.get(p.id) || "";
      const isPhysio = p.role === "terapeuta" && (
        specialty.toLowerCase().includes("fisio") || 
        specialty.toLowerCase().includes("fisica") || 
        specialty.toLowerCase().includes("física") ||
        specialty.toLowerCase().includes("rehabilitacion")
      );

      return {
        ...p,
        role: isPhysio ? "fisioterapeuta" : p.role,
        email: u ? u.email : null,
      };
    });

    // Mapear pacientes registrados que no tengan perfil aún para reflejarlos bajo "Niños (Pacientes de Terapias)"
    const existingIds = new Set(combinedProfiles.map((p: any) => p.id));
    const patientUsers = (Array.isArray(allPatients) ? allPatients : [])
      .filter((pat: any) => !existingIds.has(pat.id))
      .map((pat: any) => ({
        id: pat.id,
        first_name: pat.first_name,
        last_name: pat.last_name,
        phone: pat.phone || null,
        email: pat.email || "Registro Ficha Clínica",
        avatar_url: pat.emergency_contact || null,
        role: "paciente",
        active: pat.active !== false,
      }));

    const finalUsers = [...combinedProfiles, ...patientUsers];

    return NextResponse.json({ users: finalUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error cargando usuarios" }, { status: 500 });
  }
}
