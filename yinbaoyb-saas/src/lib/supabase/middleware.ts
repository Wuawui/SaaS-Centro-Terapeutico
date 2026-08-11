// ============================================================
// Supabase Middleware — Refresh auth tokens + role-based routing
// Optimizado: reduce queries, cache role en cookie para evitar
// el lock contention en cada request.
// Safety: wrapped in timeout to prevent infinite loading if
// Supabase is unreachable.
// ============================================================
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas protegidas por tipo
const adminPaths = ["/dashboard", "/patients", "/agenda", "/clinical", "/settings", "/therapists", "/users", "/reports", "/notifications"];
const parentPaths = ["/parent"];
const therapistPaths = ["/therapist"];
const allProtectedPaths = [...adminPaths, ...parentPaths, ...therapistPaths];

// Paths that don't need any auth logic (skip Supabase calls entirely)
const skipPaths = ["/callback", "/suspended"];

const MIDDLEWARE_TIMEOUT_MS = 5000; // 5 seconds max

export async function updateSession(request: NextRequest) {
  // Skip Supabase calls entirely for static/callback paths → instant response
  const isSkipPath = skipPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );
  if (isSkipPath) {
    return NextResponse.next({ request });
  }

  // Wrap all Supabase logic in a timeout to prevent infinite loading
  try {
    return await Promise.race([
      _updateSessionInternal(request),
      new Promise<NextResponse>((_, reject) =>
        setTimeout(() => reject(new Error("Middleware timeout")), MIDDLEWARE_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    console.error("Middleware: timeout or error, passing through:", err);
    // On timeout/error, let the request through — the client-side
    // SessionProvider will handle auth state correctly
    return NextResponse.next({ request });
  }
}

async function _updateSessionInternal(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refrescar sesión
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = allProtectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  // No autenticado → login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const developerEmail = (process.env.NEXT_PUBLIC_DEVELOPER_EMAIL || "YinbaoYB@gmail.com").toLowerCase();

  // Developer Route Protection
  if (request.nextUrl.pathname.startsWith("/developer")) {
    if (!user || user.email?.toLowerCase() !== developerEmail) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // Allow suspended page without tenant check
  if (request.nextUrl.pathname.startsWith("/suspended")) {
    return supabaseResponse;
  }

  // ── Helper: redirect preserving session cookies ──
  const redirectWithCookies = (dest: string) => {
    const response = NextResponse.redirect(new URL(dest, request.url));
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, { ...cookie });
    });
    return response;
  };

  // ── Resolve role + tenantId from cache or single DB call ──
  const resolveProfile = async (forceFresh = false) => {
    const cachedRole = !forceFresh ? request.cookies.get("sb-role")?.value : null;
    const cachedTenant = !forceFresh ? request.cookies.get("sb-tenant")?.value : null;
    const cachedActive = !forceFresh ? request.cookies.get("sb-active")?.value : null;

    if (cachedRole && cachedTenant && cachedActive !== undefined) {
      return { role: cachedRole, tenantId: cachedTenant, active: cachedActive !== "0" };
    }

    // SINGLE query: profile + tenant active status
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, tenant_id, tenants(active)")
      .eq("id", user!.id)
      .single();

    if (error) {
      console.error("Middleware DB Error caching roles:", error);
      // Retornar fallback provisorio sin cachear, previniendo lock in
      return { role: "terapeuta", tenantId: null, active: true };
    }

    const role = profile?.role || "terapeuta";
    const tenantId = profile?.tenant_id || null;
    const active = (profile as any)?.tenants?.active !== false;

    // Cache for 1 hour to avoid re-querying
    supabaseResponse.cookies.set("sb-role", String(role), { maxAge: 3600, path: "/" });
    if (tenantId) supabaseResponse.cookies.set("sb-tenant", tenantId, { maxAge: 3600, path: "/" });
    supabaseResponse.cookies.set("sb-active", active ? "1" : "0", { maxAge: 300, path: "/" });

    return { role, tenantId, active };
  };

  // ── Authenticated user going to /login → redirect to portal ──
  if (user && request.nextUrl.pathname === "/login") {
    if (user.email?.toLowerCase() === developerEmail) {
      return redirectWithCookies("/developer");
    }
    const { role } = await resolveProfile(true); // fresh on login
    let dest = "/dashboard";
    if (role === "padre") dest = "/parent";
    else if (role === "terapeuta" || role === "fisioterapeuta") dest = "/therapist";
    return redirectWithCookies(dest);
  }

  // ── Authenticated user going to "/" → redirect to portal ──
  if (user && request.nextUrl.pathname === "/") {
    if (user.email?.toLowerCase() === developerEmail) {
      return redirectWithCookies("/developer");
    }
    const { role } = await resolveProfile();
    let dest = "/dashboard";
    if (role === "padre") dest = "/parent";
    else if (role === "terapeuta" || role === "fisioterapeuta") dest = "/therapist";
    return redirectWithCookies(dest);
  }

  // ── Protected route checks ──
  if (user && isProtected) {
    const { role, active } = await resolveProfile();

    // Tenant suspended → kick
    if (!active) {
      return NextResponse.redirect(new URL("/suspended", request.url));
    }

    // Role-based access control
    const isOnAdminPath = adminPaths.some(p => request.nextUrl.pathname.startsWith(p));

    if (role === "padre" && isOnAdminPath) {
      return redirectWithCookies("/parent");
    }
    if ((role === "terapeuta" || role === "fisioterapeuta") && isOnAdminPath) {
      return redirectWithCookies("/therapist");
    }
  }

  return supabaseResponse;
}