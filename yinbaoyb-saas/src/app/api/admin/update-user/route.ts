import { NextResponse } from "next/server";
import { validateUpdateUser } from "@/lib/validations";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    const validation = validateUpdateUser(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { id, first_name, last_name, phone, role, password, active } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // 1. Obtener y verificar token de administrador
    const authHeader = request.headers.get("authorization");
    const userToken = authHeader?.replace("Bearer ", "");
    if (!userToken) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const adminRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${userToken}`, apikey: anonKey },
    });
    const adminData = await adminRes.json();
    if (!adminData.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    // 2. Verificar que es admin o director/coordinador
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${adminData.id}&select=role,tenant_id`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` },
    });
    const profiles = await profileRes.json();
    if (!profiles || profiles.length === 0) return NextResponse.json({ error: "Sin perfil" }, { status: 403 });

    const userProfile = profiles[0];
    const allowedRoles = ["super_admin", "director", "admin", "coordinador"];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    // 3. Actualizar la contraseña en el auth si se proporcionó
    if (password && password.trim().length > 0) {
      const authUpdateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
        method: "PUT",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!authUpdateRes.ok) {
        const errorData = await authUpdateRes.json();
        console.error("Error actualización auth:", errorData);
      }
    }

    // 4. Actualizar el perfil usando service_role
    const updates: any = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (phone !== undefined) updates.phone = phone;
    if (active !== undefined) updates.active = active;
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

    const isPhysio = role === "fisioterapeuta";
    if (role !== undefined) {
      updates.role = isPhysio ? "terapeuta" : role;
    }

    // Intentar actualizar profile
    const profileUpdateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    // 5. Gestionar tabla therapists según el rol
    if (role !== undefined || body.specialty !== undefined) {
      if (isPhysio || role === "terapeuta") {
        // Upsert en therapists
        await fetch(`${supabaseUrl}/rest/v1/therapists`, {
          method: "POST",
          headers: { 
            apikey: serviceKey, 
            Authorization: `Bearer ${serviceKey}`, 
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            id: id,
            specialty: isPhysio 
              ? (body.specialty || "Terapia Física / Fisioterapia") 
              : (body.specialty || "Terapia Integral"),
            license_number: body.license_number || null,
            active: active !== false,
          }),
        });
      } else if (["padre", "paciente", "admin"].includes(role)) {
        // Si cambió de terapeuta a otro rol, desactivar en therapists
        await fetch(`${supabaseUrl}/rest/v1/therapists?id=eq.${id}`, {
          method: "PATCH",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ active: false }),
        });
      }
    }

    // 6. Si el usuario existe en la tabla patients (o es paciente), actualizar también su registro clínico
    const patientUpdates: any = {};
    if (first_name !== undefined) patientUpdates.first_name = first_name;
    if (last_name !== undefined) patientUpdates.last_name = last_name;
    if (phone !== undefined) patientUpdates.phone = phone;
    if (active !== undefined) patientUpdates.active = active;
    if (body.avatar_url !== undefined) patientUpdates.emergency_contact = body.avatar_url;

    if (Object.keys(patientUpdates).length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${id}`, {
        method: "PATCH",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(patientUpdates),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update User Error:", error);
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 });
  }
}
