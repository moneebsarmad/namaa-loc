import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function normalizeSupabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error("Missing Supabase URL for middleware.");
  }

  return value.endsWith("/rest/v1/") ? value.slice(0, -"/rest/v1/".length) : value;
}

function createMiddlewareSupabaseClient() {
  const supabaseUrl = normalizeSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for middleware.");
  }

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll: () => []
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

function getSubdomain(host: string | null): string | null {
  if (!host) return null;

  const hostname = host.toLowerCase().split(":")[0];

  if (hostname === "localhost" || hostname === "namaalearning.com") {
    return null;
  }

  if (hostname.endsWith(".localhost")) {
    return hostname.slice(0, -".localhost".length);
  }

  if (hostname.endsWith(".namaalearning.com")) {
    return hostname.slice(0, -".namaalearning.com".length);
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const subdomain = getSubdomain(request.headers.get("host"));

  if (!subdomain) {
    return new NextResponse("School not found", { status: 404 });
  }

  const supabase = createMiddlewareSupabaseClient() as any;

  const { data: school, error } = await supabase
    .from("schools")
    .select("id")
    .eq("slug", subdomain)
    .eq("status", "active")
    .maybeSingle();

  if (error || !school) {
    return new NextResponse("School not found", { status: 404 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-school-id", school.id);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"]
};
