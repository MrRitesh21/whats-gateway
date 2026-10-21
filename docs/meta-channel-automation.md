# Meta channel automation (Instagram + official WhatsApp)

The dashboard at `/dashboard/autoreply` now has channel switches for the existing WhatsApp linked-device (Baileys) rules, Instagram comment replies, and WhatsApp Official Cloud API rules. The linked-device path is unchanged. Meta rules are platform-level and manageable by `SUPERADMIN` only because this version uses one deployment-configured Meta account per channel; it does not expose tokens or offer per-tenant Meta OAuth connections.

## Enable the database models

The app uses Prisma `db push` in this repository. Back up the database, then run:

```bash
npm run db:push
```

Deploy the app after the database schema update. This adds channel rule storage and the WhatsApp Cloud inbound deduplication ledger.

## Shared Meta settings

Set these as server environment variables on the deployment (not in browser/client variables):

- `META_APP_SECRET`: Meta app secret, used for signed webhook verification.
- `META_GRAPH_API_VERSION`: pinned Graph API version, currently defaulted to `v25.0`.

## Instagram comments

Configure the existing Instagram Login API settings listed in `.env.example`: `META_WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN`; set the previous environment reply fields only if you need the legacy keyword/message fallback. Create editable rules from **Dashboard → Auto Replies → Instagram**. When at least one DB rule exists, only those active rules are considered; the environment fallback is used only when the DB rule set is empty. A matched reply is sent as a private reply to the comment. The existing comment-ID ledger prevents duplicate sends.

In Meta, configure the Instagram professional account's comments webhook to:

```text
https://YOUR_HOST/api/webhooks/instagram
```

Subscribe to the `comments` field and use `META_WEBHOOK_VERIFY_TOKEN` as the verify token. The handler validates `X-Hub-Signature-256` against the raw request body using `META_APP_SECRET`.

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

- The dashboard shows a configuration indicator based on presence of required environment variables; it does not prove that Meta permissions, webhook subscriptions, or tokens are valid.
- Use a real test account and Meta's webhook tools only after setting credentials; no live credential or delivery test is part of the source-code verification.
- Do not commit real tokens or the Meta app secret. Rotate any credential accidentally exposed in logs or repository history.
- Meta channels in this implementation are platform-configured single accounts. Per-customer account linking requires a separate encrypted credential/OAuth integration and account-to-tenant mapping.
