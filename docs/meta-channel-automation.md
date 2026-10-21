# Meta channel automation (Instagram + official WhatsApp)

The dashboard has channel switches for the existing WhatsApp linked-device (Baileys) rules, Instagram comment replies, and WhatsApp Official Cloud API rules. The linked-device path is unchanged. Instagram uses per-user OAuth connections; WhatsApp Cloud rules remain platform-admin managed.

## Apply the database migration

Back up the database and verify `DATABASE_URL` points to the intended environment. This repository includes `prisma/migrations/20261021120000_instagram_channel_automation/migration.sql`, an additive migration for the Instagram connection/comment ledger, channel rules, and WhatsApp Cloud event ledger. On installations using Prisma Migrate, apply it with:

```bash
npx prisma migrate deploy
```

For databases historically managed only with `db push`, keep that workflow consistent (`npm run db:push`) rather than mixing migration histories without baselining. The migration is designed to tolerate previously `db push`-created feature tables/indexes, but still inspect the migration and back up first. Apply the database change before deploying code that queries those tables. See [Instagram Comment-to-DM setup](./instagram-comment-dm.md) for the full Meta configuration and production checklist.

## Shared Meta settings

Set server-side environment variables (never use `NEXT_PUBLIC_` for secrets):

- `META_APP_SECRET`: Meta app secret, used to validate signed webhooks.
- `META_WEBHOOK_VERIFY_TOKEN`: private verify token entered in Meta's Webhooks configuration.
- `META_GRAPH_API_VERSION`: pinned Graph API version (defaults to `v25.0`).
- `BASE_URL`: canonical HTTPS application origin, e.g. `https://YOUR_HOST`.

## Connect an Instagram account

1. In Meta App Dashboard, configure **Instagram API with Instagram Login / Business Login**. Add the exact redirect URI `https://YOUR_HOST/api/instagram/oauth/callback` to the valid OAuth redirect URIs.
2. Configure the Instagram webhook object and subscribe the app to the `comments` field. Set the callback URL to `https://YOUR_HOST/api/webhooks/instagram` and the verify token to `META_WEBHOOK_VERIFY_TOKEN`.
3. Add these server environment variables:
   - `INSTAGRAM_APP_ID`: Instagram App ID from Business Login settings.
   - `INSTAGRAM_APP_SECRET`: Instagram App Secret from Business Login settings.
   - `META_TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded as base64 (generate once with `openssl rand -base64 32`). The same key must remain stable; rotating it without re-encrypting existing rows makes stored tokens unreadable.
   - `INSTAGRAM_REDIRECT_URI`: optional override; if set, it must exactly match the URI configured in Meta. Otherwise the app uses `BASE_URL` plus `/api/instagram/oauth/callback`.
4. Visit **Dashboard → Auto Replies → Instagram** and choose **Connect Instagram account**. Sign in to the Instagram professional account and authorize the requested `instagram_business_basic` and `instagram_business_manage_comments` permissions. The app exchanges the code for a long-lived token server-side, encrypts it with AES-256-GCM before database storage, and never returns it to the browser.
5. Create rules on the same page. Rules and comment history are scoped to the signed-in owner and connected Instagram account. **Disconnect Instagram** deletes the stored connection and stops processing future webhooks for that account.

Use a professional Instagram business or creator account. Meta requires the app to be Live and appropriate Advanced Access/business verification when serving accounts beyond those added as app testers; see [Business Login for Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/) and [Instagram Webhooks](https://developers.facebook.com/documentation/instagram-platform/webhooks/). After OAuth, the app attempts the account-level `comments` webhook subscription; the dashboard shows if Meta did not confirm it. The app-level Webhooks product still must be enabled in Meta.

The previous deployment-wide `INSTAGRAM_ACCOUNT_ID` and `INSTAGRAM_ACCESS_TOKEN` variables remain supported only as a single-account compatibility fallback. New connections should use OAuth.

## WhatsApp Official Cloud API

Set the following server environment variables:

- `WHATSAPP_CLOUD_API_ENABLED=true`
- `WHATSAPP_CLOUD_ACCESS_TOKEN`: a long-lived/system-user token with the WhatsApp permissions required by your Meta app.
- `WHATSAPP_CLOUD_PHONE_NUMBER_ID`: Cloud API phone-number ID (not the display phone number or WABA ID).
- `WHATSAPP_CLOUD_VERIFY_TOKEN`: webhook verify token (if omitted, `META_WEBHOOK_VERIFY_TOKEN` is accepted).

In Meta's WhatsApp configuration, set callback URL to:

```text
https://YOUR_HOST/api/webhooks/whatsapp-cloud
```

Use `WHATSAPP_CLOUD_VERIFY_TOKEN` to verify the callback and subscribe the WABA to the `messages` webhook field. This handler accepts signed inbound text-message events only, ignores other phone-number IDs and unsupported message types, and deduplicates by Meta's inbound message ID before sending. Add rules under **Dashboard → Auto Replies → WhatsApp Official API**.

The sender posts text via `POST /{PHONE_NUMBER_ID}/messages` to the Graph API and requires Meta to accept the response before marking it sent. It only responds to inbound user messages, within Meta's customer-service messaging policy/window; template initiation, outbound campaigns, media, and template management are not implemented. An ambiguous network/API failure is recorded as failed and not retried automatically to avoid duplicate replies.

## Verification and limitations

- The dashboard configuration indicator confirms server configuration/account linkage, not that Meta permissions or end-to-end message delivery work.
- No live Meta account/token or delivery test is part of source-code verification.
- Do not commit real tokens or the Meta app secret. Rotate any credential accidentally exposed in logs or repository history.
- Token expiry is displayed in the dashboard; reconnect if the token expires or permissions are revoked.
