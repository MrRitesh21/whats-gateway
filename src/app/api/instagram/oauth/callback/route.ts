import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { encryptInstagramToken } from "@/lib/instagram-token-crypto";
import { verifyInstagramOAuthState } from "@/lib/instagram-oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATE_COOKIE = "instagram_oauth_state";

function redirectResult(request: NextRequest, result: string) {
  const url = new URL("/dashboard/autoreply/instagram", process.env.BASE_URL?.trim() || request.nextUrl.origin);
  url.searchParams.set("instagram_connect", result);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/api/instagram/oauth/callback", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function verifyState(state: string, cookieValue: string) {
  const key = process.env.AUTH_SECRET?.trim();
  return key ? verifyInstagramOAuthState(state, cookieValue, key) : null;
}

async function jsonOrError(response: Response) {
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !data || data.error) throw new Error("Instagram OAuth request failed");
  return data;
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("error")) return redirectResult(request, "cancelled");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") || "";
  const verified = verifyState(state, request.cookies.get(STATE_COOKIE)?.value || "");
  const user = await getAuthenticatedUser(request);
  if (!verified || !user || user.authMethod !== "session" || verified.userId !== user.id || !code) return redirectResult(request, "invalid_state");

  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!appId || !appSecret) return redirectResult(request, "server_not_configured");
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim() || new URL("/api/instagram/oauth/callback", process.env.BASE_URL?.trim() || request.nextUrl.origin).toString();

  try {
    const form = new FormData();
    form.set("client_id", appId);
    form.set("client_secret", appSecret);
    form.set("grant_type", "authorization_code");
    form.set("redirect_uri", redirectUri);
    form.set("code", code);
    const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const shortRoot = await jsonOrError(shortResponse);
    const shortData = Array.isArray(shortRoot.data) ? shortRoot.data[0] as Record<string, unknown> | undefined : shortRoot;
    if (!shortData) throw new Error("Instagram OAuth returned incomplete account data");
    const shortToken = typeof shortData.access_token === "string" ? shortData.access_token : "";
    const initialUserId = String(shortData.user_id || "");
    if (!shortToken || !initialUserId) throw new Error("Instagram OAuth returned incomplete account data");

    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortToken);
    const longData = await jsonOrError(await fetch(longUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) }));
    const accessToken = typeof longData.access_token === "string" ? longData.access_token : "";
    if (!accessToken) throw new Error("Instagram did not return a long-lived token");

    const profileUrl = new URL("https://graph.instagram.com/me");
    profileUrl.searchParams.set("fields", "user_id,username");
    const profileResponse = await fetch(profileUrl, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const profile = await jsonOrError(profileResponse);
    const instagramUserId = String(profile.user_id || profile.id || initialUserId);
    const username = typeof profile.username === "string" ? profile.username : "Instagram account";
    const expiresSeconds = typeof longData.expires_in === "number" ? longData.expires_in : 60 * 24 * 60 * 60;
    const scopeValue = typeof shortData.permissions === "string" ? shortData.permissions : Array.isArray(shortData.permissions) ? shortData.permissions.filter((item): item is string => typeof item === "string").join(",") : "instagram_business_basic,instagram_business_manage_comments";
    const encryptedAccessToken = encryptInstagramToken(accessToken);

    const now = new Date();
    await prisma.instagramAccountConnection.upsert({
      where: { userId: user.id },
      create: { userId: user.id, instagramUserId, username, encryptedAccessToken, tokenExpiresAt: new Date(now.getTime() + expiresSeconds * 1000), grantedScopes: scopeValue },
      update: { instagramUserId, username, encryptedAccessToken, tokenExpiresAt: new Date(now.getTime() + expiresSeconds * 1000), grantedScopes: scopeValue, webhookSubscribed: false },
    });

    let webhookSubscribed = false;
    try {
      const version = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
      const subscribeResponse = await fetch(`https://graph.instagram.com/${version}/${encodeURIComponent(instagramUserId)}/subscribed_apps`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ subscribed_fields: "comments" }), cache: "no-store", signal: AbortSignal.timeout(12000),
      });
      const subscribed = await subscribeResponse.json().catch(() => null) as { success?: unknown } | null;
      webhookSubscribed = subscribeResponse.ok && subscribed?.success === true;
    } catch { /* Account connection remains valid; UI reports pending webhook subscription. */ }
    await prisma.instagramAccountConnection.update({ where: { userId: user.id }, data: { webhookSubscribed } });
    return redirectResult(request, webhookSubscribed ? "success" : "connected_webhook_pending");
  } catch {
    return redirectResult(request, "failed");
  }
}
