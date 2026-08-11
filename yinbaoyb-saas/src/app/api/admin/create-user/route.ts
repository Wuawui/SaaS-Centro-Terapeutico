import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, first_name, last_name, phone, role, tenant_id, specialty, license_number, therapeutic_approach, max_patients } = body;

  // Verificar que el usuario que hace la petición es admin
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Obtener el token del usuario autenticado
  const authHeader = request.headers.get("authorization");
  const userToken = authHeader?.replace("Bearer ", "");

  if (!userToken) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar que es admin
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
    return NextResponse.json({ error: "No tienes permisos para crear usuarios" }, { status: 403 });
  }

  const userTenantId = tenant_id || userProfile.tenant_id;

  // Crear usuario con service_role usando el email ingresado por el administrador
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  const userData = await createRes.json();

  if (!createRes.ok) {
    const errorMsg = (userData.msg || userData.message || "").toLowerCase();
    // Si ya existe, buscarlo (soportando localización en inglés, español y códigos estándar)
    if (
      errorMsg.includes("already registered") || 
      errorMsg.includes("already exists") || 
      errorMsg.includes("ya ha sido registrado") || 
      errorMsg.includes("ya existe") ||
      errorMsg.includes("email_exists") ||
      errorMsg.includes("correo electronico ya")
    ) {
      // Buscar usuario existente
      const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const listData = await listRes.json();
      const existingUser = listData.users?.[0];
      if (!existingUser) {
        return NextResponse.json({ error: "Error creando usuario: " + (userData.msg || JSON.stringify(userData)) }, { status: 400 });
      }
      userData.id = existingUser.id;
    } else {
      return NextResponse.json({ error: "Error creando usuario: " + (userData.msg || JSON.stringify(userData)) }, { status: 400 });
    }
  }

  const userId = userData.id;

  // Crear perfil
  const profileBody = {
    id: userId,
    tenant_id: userTenantId,
    role: role || "terapeuta",
    first_name,
    last_name,
    phone: phone || null,
    active: true,
  };

  const profileInsertRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(profileBody),
  });

  if (!profileInsertRes.ok) {
    const errData = await profileInsertRes.json();
    // Si el perfil ya existe, no es error
    if (!errData.message?.includes("duplicate") && !errData.message?.includes("already exists")) {
      // Rollback: eliminar usuario
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      return NextResponse.json({ error: "Error creando perfil: " + (errData.message || JSON.stringify(errData)) }, { status: 400 });
    }
  }

  // Si es terapeuta o fisioterapeuta, crear registro en therapists
  const isTherapistRole = (role === "terapeuta" || role === "fisioterapeuta" || !role);
  if (isTherapistRole) {
    const therapistBody: Record<string, unknown> = {
      id: userId,
      specialty: specialty || null,
      license_number: license_number || null,
      therapeutic_approach: therapeutic_approach?.length > 0 ? therapeutic_approach : null,
      max_patients: max_patients || 20,
      active: true,
    };

    const therapistRes = await fetch(`${supabaseUrl}/rest/v1/therapists`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(therapistBody),
    });

    if (!therapistRes.ok) {
      const errData = await therapistRes.json();
      console.error("Error creating therapist:", errData);
    }
  }

  return NextResponse.json({
    success: true,
    user: {
      id: userId,
      email: userData.email || email,
      role: role || "terapeuta",
    },
  });
}