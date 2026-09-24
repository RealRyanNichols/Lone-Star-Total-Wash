# Lone Star Total Wash

Public website and quote intake for Travis Nichols's mobile fleet and pressure-washing business in Hallsville, Texas.

- Canonical site: <https://www.lonestartotalwash.com>
- Business phone: `(903) 431-8489`
- DigitalOcean staging host: <https://lonestar.165-227-248-110.sslip.io>
- Production process port: `127.0.0.1:3107`

## What this repository contains

The source was rebuilt in September 2026 after the original Next.js source was lost. `recovered-site/` preserves the 2026-09-19 production mirror. The maintainable replacement is the small Node application at the repository root.

The replacement includes:

- 16 statically generated, mobile-first pages
- four service-specific search pages
- an East Texas service-area page
- a real completed-work gallery using Lone Star Total Wash photos
- published fleet, equipment, and flat-work base prices
- three practical search guides
- LocalBusiness, Service, FAQ, and Article structured data
- canonical URLs, sitemap, robots file, and legacy URL redirects
- an accessible quote form with consent, validation, honeypot, origin checks, size limits, and rate limits
- Supabase lead delivery with a temporary Vercel API fallback
- optional Resend notifications that do not block lead storage
- a hardened systemd service and Caddy configs for staging and production

No framework or runtime package is required. The generator and web server use Node built-ins so the site is cheap to run and straightforward to recover.

## Local development

Requires Node 22 or newer.

```bash
npm run build
QUOTE_UPSTREAM_URL=https://lone-star-total-wash.vercel.app/api/quote npm start
```

Then open <http://127.0.0.1:3107>.

Run all checks:

```bash
npm run check
```

## Quote delivery

The preferred path writes directly to Supabase table `public.leads` in project `wtqzielipmbvvarcebws` with the public anon key. Never put a Supabase service-role key in this application.

During the migration, `QUOTE_UPSTREAM_URL` can forward valid submissions to the existing Vercel route. That fallback keeps the form working during DNS cutover, but it should be removed after direct Supabase delivery and notifications are verified on DigitalOcean.

Optional Resend variables send a notification after the lead is saved. A notification failure is logged by request ID only and does not discard the saved lead. Raw quote contents are not written to application logs.

Copy `.env.example` to the protected server environment file and set only the values that are actually used:

```text
/srv/site-env/lonestar.env
```

The file should be owned by root with mode `0600`.

## DigitalOcean deployment

The existing droplet checkout is `/srv/sites/lonestar`.

```bash
cd /srv/sites/lonestar
git fetch origin
git switch main
git pull --ff-only origin main
npm run build
sudo cp deployment/lonestar.service /etc/systemd/system/lonestar.service
sudo systemctl daemon-reload
sudo systemctl enable --now lonestar.service
sudo cp deployment/lonestar.staging.caddy /etc/caddy/sites/lonestar.caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -fsS https://lonestar.165-227-248-110.sslip.io/api/health
```

Do not copy the production Caddy file until staging pages, the quote delivery path, and notification delivery have all passed.

## Production cutover gates

These are separate completion gates:

1. The build passes locally and on the droplet.
2. The systemd process is active on port 3107.
3. The staging hostname returns the rebuilt site over HTTPS.
4. A controlled quote reaches the intended Supabase table.
5. The owner notification reaches the intended inbox or phone workflow.
6. Existing domain DNS is changed from Vercel to the DigitalOcean reserved IP `165.227.248.110`.
7. The production Caddy config obtains valid certificates for both apex and `www`.
8. Canonical pages, old URL redirects, sitemap, robots, structured data, images, call links, and quote form are verified on the public domain.
9. Search Console receives the canonical sitemap and indexing is checked separately.
10. Vercel is left available for rollback until the DigitalOcean site has remained healthy through the agreed observation window.

## Data and copy guardrails

- Do not put customer contact details in logs, URLs, analytics events, or public pages.
- Do not add a street address unless Travis confirms it is a public business location.
- Do not claim rankings, guaranteed leads, guaranteed results, certifications, or environmental compliance without current support.
- Keep final prices in a written estimate. The published page contains base rates and the conditions that may change an estimate.
- Use completed work from this repository as proof. Do not substitute stock images for client results.
