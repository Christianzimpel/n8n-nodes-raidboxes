# n8n-nodes-raidboxes

n8n community node for the [Raidboxes API](https://api.raidboxes.io/documentation). Manage WordPress Boxes, backups, cache, settings, subscriptions and SSH keys from your n8n workflows.

> Unofficial. Not affiliated with or endorsed by Raidboxes GmbH.

## Installation

In n8n: **Settings → Community Nodes → Install** and enter `n8n-nodes-raidboxes`.

## Credentials

<a id="credentials"></a>

Raidboxes authenticates with email and password (`POST /v1/login`). The node logs in automatically, stores the JWT and logs in again when the token expires.

**Two-factor authentication:** enter the Base32 **2FA Secret** (the text behind the QR code shown when you set up 2FA). The node then generates the 6-digit code for each login itself, so 2FA accounts also work unattended. Leave the field empty if 2FA is off.

Tip: use a dedicated Raidboxes user that only has access to the Boxes your workflow needs.

## Rate limits

Raidboxes allows 100 requests/min in general, 20/min for creating resources and 10/min for authentication (per user). On HTTP 429 the node waits (respecting `X-RateLimit-Reset`) and retries up to 3 times.

## Operations

| Resource | Operations |
|---|---|
| **Box** | Create, Delete, Get, Get Many, Get Metrics (CPU / memory / storage), Get Log, Get / Install / Remove SSL Certificate, Get WordPress Users, Unban All IPs |
| **Backup** | Create, Get Many, Delete, Restore, Clone, Get Download Link |
| **Cache** | Clear (all / OPcache / Varnish), Get Settings, Update Settings |
| **Box Setting** | Get (PHP, WordPress, SSH, Redis, website access, IP blocking, user agents), Get for Many Boxes, Update PHP, Update WordPress, Update WordPress Version, Update SSH, Update IP Blocking, Update User Agent Blocking, Update Website Access |
| **Process** | Get, Wait for Completion |
| **Subscription** | Get Many, Cancel, Revoke Cancellation, Cancel Add-Ons, Revoke Add-On Cancellation |
| **SSH Key** | Get Many, Create, Delete |
| **WordPress** | Get Versions |

### Async operations

Creating Boxes and creating, restoring, cloning or deleting backups run asynchronously at Raidboxes and return a process. With **Wait for Completion** (on by default) the node polls `GET /v1/processes/{id}` until the process is finished, fails, or times out. You can change the poll interval and the timeout. Without waiting, the node returns the process ID right away, and you can use **Process → Wait for Completion** later in the workflow.

The node is also usable as a tool for the n8n AI Agent.

## Example workflows

- **Safe update:** Backup → Create (wait) → update plugins → check the site → if it fails, Backup → Restore.
- **Monitoring:** Schedule → Box → Get Many → Box → Get Metrics (split into items) → IF CPU > 80 % → Slack / email.
- **SSL watch:** Schedule → Box → Get SSL Certificate → IF `expires_at` < 14 days → notify.

## Notes on the live API (Nov 2026)

Tested against the live API. Differences to the OpenAPI spec that the node handles:

- `GET /v1/boxes` returns the list under `boxes`, other lists under `data`.
- Pagination uses camelCase (`meta.lastPage`).
- `POST /v1/boxes/{id}/backups` returns `202` without a process id.
- The process of `POST /v1/boxes` can stay `accepted` after the Box exists.
- Valid `performance_level` for a free Box is `mini` (the docs show `basic`, which is rejected).

## Development

```bash
npm install
npm run build
npm test      # offline mock tests against a fake API
npm run lint
```

Link into a local n8n: `npm link` in this folder, then `npm link n8n-nodes-raidboxes` in `~/.n8n/custom`.

## License

MIT
