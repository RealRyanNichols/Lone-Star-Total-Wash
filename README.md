# Lone Star Total Wash

Live site: https://www.lonestartotalwash.com

## Read this first

**The original source code for this site no longer exists.**

It was deployed to Vercel from a local folder, never pushed here. Vercel has since
purged the deployment source blobs. As of 2026-09-19 every file in that deployment
returns HTTP 410 Gone. The Mac it was built on was searched by filename and by
content and has no copy.

What is in this repo is a mirror of the live production site, captured 2026-09-19,
plus everything needed to rebuild it.

## What the original app was

Next.js App Router, static export plus one serverless route. From the surviving
Vercel file listing:

    src/app/page.tsx           home
    src/app/prices/page.tsx    prices
    src/app/jobs/page.tsx      jobs
    src/app/quote/page.tsx     quote form
    src/app/admin/page.tsx     admin (not public, not captured)
    src/app/api/quote/route.ts quote handler
    src/app/layout.tsx
    src/app/globals.css
    src/app/robots.ts
    src/app/sitemap.ts
    src/lib/config.ts

## recovered-site/

Complete mirror of the public site. 20 files. Pages: index, prices, jobs, quote,
plus the compiled Next chunks and CSS. This is exactly what visitors see today.

The admin page was not linked publicly so it was not captured.

## The quote form

Verified working end to end on 2026-09-19. A test submission was accepted and
landed in the database with all fields intact, then was deleted.

    POST /api/quote
    required: name, phone
    optional: email, address, city, services[], message
    success:  200 {"ok": true}
    missing:  400 {"error": "Name and phone are required"}

Writes to Supabase project `wtqzielipmbvvarcebws`, table `public.leads`.

    id uuid pk
    name text
    phone text
    email text
    address text
    city text
    services text[]
    message text
    source text default 'website'
    status text default 'new'
      check in (new, contacted, estimate_sent, accepted, paid, closed)
    created_at timestamptz default now()

RLS policies:

    anon can insert leads            INSERT  anon           with check true
    authenticated can read leads     SELECT  authenticated  true
    authenticated can update leads   UPDATE  authenticated  true

Anon insert is allowed, so rebuilding needs only the Supabase URL and the anon
key. No service role key is required and none should be used here.

The Vercel project has **zero environment variables**, so nothing secret was lost
with the source.

## Two things to know before relaunching

1. **The leads table has zero rows.** The form works, so this is a traffic problem,
   not a code problem.

2. **Nothing notifies anyone when a lead arrives.** A submission lands in the
   Supabase table and stops there. There is no email and no text. Someone has to
   open the database to find out a customer asked for a quote. Wire up a
   notification before sending any traffic at this form.

## Assets

The logo is served from that Supabase project's public storage bucket:

    /storage/v1/object/public/assets/logo.png

## Lesson

Vercel keeps the build, not the source. Any site whose only copy is a Vercel
deployment is one retention window away from gone.
