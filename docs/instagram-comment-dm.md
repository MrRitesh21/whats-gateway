# Instagram Comment-to-DM (inside the existing WAFlow app)

This feature is part of the existing WAFlow/WhatsGateway Next.js application. It reuses its sign-in, PostgreSQL/Prisma database, webhook routes, and dashboard; it is not a separate app. Existing WhatsApp linked-device automation remains intact. WhatsApp Cloud API, when enabled, continues to use its own webhook, credentials, and rules.

## What it does

- A dashboard owner connects an Instagram professional account using Meta's official Instagram API with Instagram Login (Business Login for Instagram). OAuth tokens are encrypted server-side with AES-256-GCM; they are not returned to the browser.
- Meta's `comments` webhook is verified against the **exact raw request body** with `X-Hub-Signature-256` and the Meta App Secret. The webhook is account-routed to the matching stored OAuth connection.
- Rules support case-insensitive `CONTAINS`, `EXACT`, `STARTS_WITH`, and `REGEX` matching. For manually specified spelling/typo variants, enter a comma-separated list, for example `details, detials, detailes`; no unbounded fuzzy matching is used.
- A matching comment is privately replied to through Meta's documented `/{IG_ID}/messages` private-reply flow using `recipient.comment_id`.[3] Enter the complete reply text and link in the rule response (put the link on a new line if preferred). Meta's API limits a private reply to one per comment and requires it within 7 days (Instagram Live comments: during the live only).[3]
- The comment ID is claimed under a database unique constraint **before** the Meta send call, so duplicate/retried webhook deliveries cannot start a second send. Failed/ambiguous send results are recorded and deliberately not automatically retried.
- `Dashboard → Instagram Comments` shows the latest 50 comments for the signed-in owner, including matched variant and DM status (`ignored`, `processing`, `sent`, or `failed`).
- `Dashboard → Auto Replies → Instagram` manages the Instagram connection and rules. Instagram OAuth data and rules are separate from WhatsApp Cloud API credentials/rules.

## Environment configuration (server only)

Set these in the existing app's secret environment settings. Do not use `NEXT_PUBLIC_` variables for any secret or token, and do not commit values.

| Variable | Purpose |
| --- | --- |
| `BASE_URL` | Canonical public HTTPS origin of this existing app, e.g. `https://your-host.example` |
| `INSTAGRAM_APP_ID` | Instagram App ID from the Meta Business Login for Instagram settings |
| `INSTAGRAM_APP_SECRET` | Instagram App Secret; used only server-side for OAuth exchange |
| `INSTAGRAM_REDIRECT_URI` | Optional exact override; otherwise `BASE_URL/api/instagram/oauth/callback` |
| `META_APP_SECRET` | Meta App Secret used for webhook HMAC verification |
| `META_WEBHOOK_VERIFY_TOKEN` | Random webhook verification string; enter the same value in Meta's Webhooks configuration |
| `META_TOKEN_ENCRYPTION_KEY` | 32 random bytes, Base64-encoded; generate with `openssl rand -base64 32`. Keep stable and backed up: rotation without re-encrypting stored rows makes tokens unreadable. |
| `META_GRAPH_API_VERSION` | Pinned Instagram Graph API version; defaults in this app to `v25.0` |

`INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_ACCOUNT_ID` remain only as a legacy, single-account fallback; new connections should use OAuth from the Instagram dashboard. WhatsApp Cloud variables (`WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_VERIFY_TOKEN`, and `WHATSAPP_CLOUD_API_ENABLED`) are separate and must not be used as Instagram credentials.

## Meta App setup — step by step

1. In [Meta for Developers](https://developers.facebook.com/), select/create the Business-type Meta app used by this existing service. Add Instagram and configure **Instagram API with Instagram Login / Business Login for Instagram**. The Instagram Login flow is separate from Facebook Login, does not require a linked Facebook Page, and issues the Instagram User access token used by this code.[1]
2. In the Instagram Business Login settings, add the exact OAuth redirect URI `https://YOUR_EXISTING_HOST/api/instagram/oauth/callback`. Set `BASE_URL` to the canonical HTTPS origin and, if overriding, set `INSTAGRAM_REDIRECT_URI` to exactly the same URI. Add the App ID, App Secret, encryption key, webhook secret, verify token, and API version to the existing service's server-side environment settings. Restart/redeploy after saving.
3. Configure only the permissions needed for this feature: `instagram_business_basic` and `instagram_business_manage_comments`. Meta's current private-reply guide lists these for Instagram Login; the app requests both during OAuth.[3] Use Standard Access for accounts you own/manage and have added as app testers; request Advanced Access and complete Meta's applicable review/business verification before serving outside accounts.[1][2]
4. In Meta App Dashboard → **Webhooks**, select the Instagram object and set callback URL to `https://YOUR_EXISTING_HOST/api/webhooks/instagram`. Enter the same `META_WEBHOOK_VERIFY_TOKEN`. Use **Verify and Save**; Meta sends a GET challenge which the existing app's route validates and echoes. Subscribe the app to the `comments` field. The callback requires valid public HTTPS/TLS.[2]
5. In the existing WAFlow dashboard, sign in as the account owner, open **Auto Replies → Instagram**, and choose **Connect Instagram account**. Complete Meta's authorization screen. On callback the app exchanges the authorization code server-side, stores an encrypted long-lived token, discovers the professional account, and attempts the account-level `comments` subscription. If the dashboard does not confirm subscription, check Meta app webhook configuration, permissions, token status, and server logs before testing.[1][2]
6. Add an Instagram rule. In the keyword field, supply a trigger or comma-separated spelling variants (case-insensitive); choose the matching mode; enter the private-reply message and link in the response. Save and enable the rule.
7. Test with a new real comment on a post/reel of the connected professional account containing a trigger spelling. Check **Instagram Comments** for the resulting event and delivery status. A successful `sent` status requires Meta to return a message ID. For production accounts outside app testers, set the Meta app Live and receive the required access approvals. Meta's private replies are one-per-comment and subject to its 7-day limit (Live comments are only eligible during the live broadcast).[2][3]

## Existing-app database migration and deployment

The migration at `prisma/migrations/20261021120000_instagram_channel_automation/migration.sql` adds the Instagram connection, comment ledger, channel rules, and WhatsApp Cloud event-ledger tables to the existing database; it references the existing `User` table and creates no new app or database. It is idempotent for feature tables/indexes previously created with Prisma `db push`, and adds the optional `ChannelAutoReplyRule.userId` column if that earlier table predates owner-scoped Instagram rules.

1. Back up the existing Postgres database and verify `DATABASE_URL` targets the intended environment.
2. Use the database's established Prisma workflow. On a database managed with Prisma Migrate, apply this migration with `npx prisma migrate deploy`; an existing non-empty database without `_prisma_migrations` must first be deliberately baselined (`migrate deploy` otherwise returns P3005). On an installation historically managed by `db push` (as the configured DB for this app was), continue with `npm run db:push` after backup. Applying the SQL file directly is additive but does **not** register it in `_prisma_migrations`; do not switch such a database to Prisma Migrate without baselining.
3. Confirm the existing app starts and the migration/schema is present, then set the Meta environment variables above and redeploy the same service.
4. Configure the Meta callback and OAuth flow, then test. `GET /api/health` alone is not proof that the feature routes, database schema, webhook subscription, or real private replies work; verify the feature through the live dashboard and a real test comment.

## Sources

[1] https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login — Meta Business Login for Instagram
[2] https://developers.facebook.com/docs/instagram-platform/webhooks — Meta Instagram Webhooks
[3] https://developers.facebook.com/docs/instagram-platform/private-replies — Meta Instagram Private Replies
