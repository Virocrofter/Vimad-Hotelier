# Vimad Developer Webhooks

Signed, retried, observable HTTP callbacks for your property. Manage endpoints at
**/app/developer** (owner/admin) or via the API below.

## Quick start

1. Register an endpoint: `POST /v1/webhooks` with `{ "url": "https://you/hook", "events": ["*"] }`.
2. The response includes your **signing secret, shown once**. Store it - it is never returned again.
3. Vimad POSTs events to your URL. Verify each request (below). Replay any delivery from the portal.

## Request shape

Headers:

- `X-Vimad-Event` - the event name (e.g. `reservation.checked_in`).
- `X-Vimad-Timestamp` - Unix seconds when the payload was signed.
- `X-Vimad-Signature` - hex HMAC-SHA256 of `{timestamp}.{rawBody}` with your endpoint secret.

Body:

    { "id": "delivery id", "event": "folio.charge", "data": { }, "sentAt": "ISO timestamp" }

## Verifying the signature (Node)

    const crypto = require('node:crypto');
    const ts = req.headers['x-vimad-timestamp'];
    const body = rawBody; // the exact request body, unparsed
    const expected = crypto.createHmac('sha256', SECRET).update(ts + '.' + body).digest('hex');
    if (expected !== req.headers['x-vimad-signature']) throw new Error('bad signature');
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) throw new Error('stale');

## Rotation

`POST /v1/webhooks/:id/rotate` returns a new secret. The **previous secret stays valid for 24h**
(grace window for zero-downtime rotation), then is rejected. Signatures verify against either
secret inside the window.

## Retries & replay

Failed deliveries retry with exponential backoff: **1m, 5m, 30m, 2h, 12h** (5 attempts), then
mark `failed`. Any delivery can be re-queued manually:

    POST /v1/webhooks/deliveries/:id/replay

Watch status per endpoint in the portal (live feed) or `GET /v1/webhooks/deliveries?endpointId=&status=`.

## Events

| Event                     | Fires when                                                      |
| ------------------------- | --------------------------------------------------------------- |
| `reservation.checked_in`  | A reservation checks in                                         |
| `reservation.checked_out` | A reservation checks out                                        |
| `folio.charge`            | Any charge posts to a folio                                     |
| `test`                    | Fired by the Test button / `POST /v1/webhooks/test/:endpointId` |
| `*`                       | Subscribe to all current and future events                      |

## API reference (owner/admin only)

| Method | Path                                 | Purpose                                  |
| ------ | ------------------------------------ | ---------------------------------------- |
| POST   | `/v1/webhooks`                       | Register endpoint (returns secret once)  |
| GET    | `/v1/webhooks`                       | List endpoints (no secrets)              |
| PATCH  | `/v1/webhooks/:id`                   | Update URL / events / pause-resume       |
| POST   | `/v1/webhooks/:id/rotate`            | Rotate signing secret (24h grace)        |
| DELETE | `/v1/webhooks/:id`                   | Remove endpoint                          |
| POST   | `/v1/webhooks/test/:endpointId`      | Fire a test event                        |
| GET    | `/v1/webhooks/deliveries`            | Delivery log (filter by endpoint/status) |
| POST   | `/v1/webhooks/deliveries/:id/replay` | Re-queue a delivery                      |
