import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { createInstagramOAuthState } from "@/lib/instagram-oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATE_COOKIE = "instagram_oauth_state";
const STATE_MAX_AGE = 10 * 60;
const OAUTH_SCOPES = ["instagram_business_basic", "instagram_business_manage_comments"];

function stateKey() {
  const key = process.env.AUTH_SECRET?.trim();
  if (!key) throw new Error("AUTH_SECRET is not configured");
  return key;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.authMethod !== "session") return NextResponse.json({ error: "Please sign in with your dashboard session first" }, { status: 401 });
  if (user.role === "STAFF") return NextResponse.json({ error: "Only account owners can connect Instagram" }, { status: 403 });
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  if (!appId || !process.env.INSTAGRAM_APP_SECRET?.trim() || !process.env.META_TOKEN_ENCRYPTION_KEY?.trim() || !process.env.META_APP_SECRET?.trim() || !process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()) {
    return NextResponse.json({ error: "Instagram connection is not configured on the server" }, { status: 503 });
  }
  try {
    const state = createInstagramOAuthState(user.id, stateKey(), Date.now() + STATE_MAX_AGE * 1000);
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim() || new URL("/api/instagram/oauth/callback", process.env.BASE_URL?.trim() || request.nextUrl.origin).toString();
    const authorize = new URL("https://www.instagram.com/oauth/authorize");
    authorize.searchParams.set("client_id", appId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", OAUTH_SCOPES.join(","));
    authorize.searchParams.set("state", state);
    const response = NextResponse.redirect(authorize);
    response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/instagram/oauth/callback", maxAge: STATE_MAX_AGE });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.json({ error: "Could not start Instagram connection" }, { status: 500 });
  }
}
