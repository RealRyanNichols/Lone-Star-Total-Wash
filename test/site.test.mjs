import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
let upstream;
let upstreamUrl;
let app;
let appUrl;
let forwardedQuote;

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address())));
}

before(async () => {
  upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    forwardedQuote = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"ok":true}');
  });
  const upstreamAddress = await listen(upstream);
  upstreamUrl = `http://127.0.0.1:${upstreamAddress.port}/api/quote`;

  const port = 32000 + Math.floor(Math.random() * 2000);
  appUrl = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      QUOTE_UPSTREAM_URL: upstreamUrl,
      ALLOWED_ORIGINS: "https://www.lonestartotalwash.com",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${appUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Test server did not start");
});

after(async () => {
  app?.kill("SIGTERM");
  await new Promise((resolve) => upstream?.close(resolve));
});

test("build contains the search and conversion pages", async () => {
  const expected = [
    "dist/index.html",
    "dist/services/fleet-washing/index.html",
    "dist/services/heavy-equipment-washing/index.html",
    "dist/services/commercial-pressure-washing/index.html",
    "dist/services/residential-pressure-washing/index.html",
    "dist/pricing/index.html",
    "dist/work/index.html",
    "dist/service-areas/index.html",
    "dist/guides/index.html",
    "dist/quote/index.html",
    "dist/sitemap.xml",
    "dist/robots.txt",
  ];
  await Promise.all(expected.map((file) => access(new URL(`../${file}`, import.meta.url))));
});

test("homepage includes canonical metadata, local proof, and structured data", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.lonestartotalwash\.com"/);
  assert.match(html, /Hallsville-based/);
  assert.match(html, /Mobile Fleet Washing/);
  assert.match(html, /application\/ld\+json/);
  assert.doesNotMatch(html, /aggregateRating/);
});

test("every generated page has concise search metadata", async () => {
  const files = (await walk(new URL("../dist/", import.meta.url))).filter((file) => file.pathname.endsWith(".html"));
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] || "";
    assert.ok(title.length > 10 && title.length <= 60, `${file.pathname} title length is ${title.length}`);
    assert.ok(description.length >= 90 && description.length <= 160, `${file.pathname} description length is ${description.length}`);
  }
});

test("generated internal links and media targets exist", async () => {
  const dist = new URL("../dist/", import.meta.url);
  const files = (await walk(dist)).filter((file) => file.pathname.endsWith(".html"));
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const targets = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((match) => match[1]);
    for (const rawTarget of targets) {
      const target = rawTarget.split(/[?#]/)[0];
      if (!target || target.startsWith("/api/")) continue;
      const relative = target === "/" ? "index.html" : target.endsWith("/") ? `${target.slice(1)}index.html` : target.slice(1);
      await assert.doesNotReject(access(new URL(relative, dist)), `${file.pathname} points to missing ${target}`);
    }
  }
});

test("legacy public URLs redirect to their canonical replacements", async () => {
  const routes = new Map([
    ["/prices", "/pricing/"],
    ["/prices/", "/pricing/"],
    ["/prices.html", "/pricing/"],
    ["/jobs", "/work/"],
    ["/jobs/", "/work/"],
    ["/jobs.html", "/work/"],
    ["/quote.html", "/quote/"],
    ["/quote.html/", "/quote/"],
  ]);
  for (const [path, destination] of routes) {
    const response = await fetch(`${appUrl}${path}`, { redirect: "manual" });
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get("location"), destination, path);
  }
});

test("security headers are present on public pages", async () => {
  const response = await fetch(`${appUrl}/`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
});

test("quote endpoint validates required fields", async () => {
  const response = await fetch(`${appUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.lonestartotalwash.com" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
});

test("quote endpoint rejects unknown browser origins", async () => {
  const response = await fetch(`${appUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.invalid" },
    body: JSON.stringify({ name: "Test Customer", phone: "903-555-0100", consent: true }),
  });
  assert.equal(response.status, 403);
});

test("valid quote is delivered without raw contact data in the response", async () => {
  const response = await fetch(`${appUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.lonestartotalwash.com" },
    body: JSON.stringify({
      name: "Test Customer",
      phone: "903-555-0100",
      email: "test@example.com",
      city: "Hallsville",
      services: ["Fleet washing"],
      message: "Test request only",
      consent: true,
      source: "test",
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(body.requestId);
  assert.equal(body.phone, undefined);
  assert.equal(forwardedQuote.phone, "903-555-0100");
  assert.deepEqual(forwardedQuote.services, ["Fleet washing"]);
});
