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
    const allProfilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?tenant_id=eq.${userProfile.tenant_id}&select=id,first_name,last_name,phone,role,active,tenant_id&order=role.asc`, {
      headers: fetchHeaders,
    });
    const allProfiles = (await allProfilesRes.json()) || [];

    // 2. Obtener todos los pacientes registrados de la tabla patients
    const allPatientsRes = await fetch(`${supabaseUrl}/rest/v1/patients?tenant_id=eq.${userProfile.tenant_id}&select=id,first_name,last_name,phone,email,active&order=created_at.desc`, {
      headers: fetchHeaders,
    });
    const allPatients = (await allPatientsRes.json()) || [];

    // 3. Obtener usuarios de Auth
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: fetchHeaders,
    });
    const authData = await authRes.json();
    const authUsers = authData.users || [];

    // Mapear perfiles
    const combinedProfiles = allProfiles.map((p: any) => {
      const u = authUsers.find((user: any) => user.id === p.id);
      return {
        ...p,
        email: u ? u.email : null,
      };
    });

    // Mapear pacientes registrados que no tengan perfil aún para reflejarlos bajo "Niños (Pacientes de Terapias)"
    const existingIds = new Set(combinedProfiles.map((p: any) => p.id));
    const patientUsers = allPatients
      .filter((pat: any) => !existingIds.has(pat.id))
      .map((pat: any) => ({
        id: pat.id,
        first_name: pat.first_name,
        last_name: pat.last_name,
        phone: pat.phone || null,
        email: pat.email || "Registro Ficha Clínica",
        role: "paciente",
        active: pat.active !== false,
      }));

    const finalUsers = [...combinedProfiles, ...patientUsers];

    return NextResponse.json({ users: finalUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error cargando usuarios" }, { status: 500 });
  }
}
