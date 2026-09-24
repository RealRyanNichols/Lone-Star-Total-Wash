import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./dist", import.meta.url)));
const port = Number(process.env.PORT || 3107);
const host = process.env.HOST || "127.0.0.1";
const maxBody = 32 * 1024;
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "https://www.lonestartotalwash.com,https://lonestartotalwash.com,https://lonestar.165-227-248-110.sslip.io").split(",").map((item) => item.trim()).filter(Boolean));
const rateLimits = new Map();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const legacyRedirects = new Map([
  ["/index.html", "/"],
  ["/prices", "/pricing/"],
  ["/prices.html", "/pricing/"],
  ["/jobs", "/work/"],
  ["/jobs.html", "/work/"],
  ["/quote.html", "/quote/"],
]);

function securityHeaders(contentType = "text/plain; charset=utf-8") {
  return {
    "content-type": contentType,
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'",
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { ...securityHeaders("application/json; charset=utf-8"), "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function quotePayload(input) {
  const services = Array.isArray(input.services) ? input.services.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 8) : [];
  return {
    name: cleanText(input.name, 100),
    phone: cleanText(input.phone, 30),
    email: cleanText(input.email, 150),
    address: cleanText(input.address, 180),
    city: cleanText(input.city, 80),
    services,
    message: cleanText(input.message, 2000),
    source: cleanText(input.source, 50) || "website",
    consent: input.consent === true,
    companyWebsite: cleanText(input.companyWebsite, 200),
  };
}

function validateQuote(quote) {
  if (!quote.name || quote.name.length < 2) return "Name is required";
  if (!quote.phone || quote.phone.replace(/\D/g, "").length < 7) return "A valid phone number is required";
  if (quote.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.email)) return "Email address is invalid";
  if (!quote.consent) return "Contact consent is required";
  return "";
}

function rateLimited(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) || request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const record = rateLimits.get(key);
  if (!record || record.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  record.count += 1;
  return record.count > 6;
}

async function readJson(request) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > maxBody) throw new Error("PAYLOAD_TOO_LARGE");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBody) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function saveToSupabase(quote) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return false;
  const response = await fetch(`${baseUrl}/rest/v1/leads`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: quote.name,
      phone: quote.phone,
      email: quote.email || null,
      address: quote.address || null,
      city: quote.city || null,
      services: quote.services,
      message: quote.message || null,
      source: quote.source === "website" ? "website" : `website:${quote.source}`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`SUPABASE_${response.status}`);
  return true;
}

async function saveToUpstream(quote) {
  const upstream = process.env.QUOTE_UPSTREAM_URL;
  if (!upstream) return false;
  const response = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: quote.name, phone: quote.phone, email: quote.email, address: quote.address, city: quote.city, services: quote.services, message: quote.message }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
  return true;
}

function htmlEscape(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function sendNotification(quote, requestId) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.QUOTE_NOTIFICATION_TO;
  const from = process.env.QUOTE_NOTIFICATION_FROM;
  if (!apiKey || !to || !from) return { configured: false };
  const rows = [
    ["Name", quote.name], ["Phone", quote.phone], ["Email", quote.email || "Not provided"], ["Address", quote.address || "Not provided"], ["City", quote.city || "Not provided"], ["Services", quote.services.join(", ") || "Not selected"], ["Message", quote.message || "Not provided"], ["Source", quote.source], ["Request", requestId],
  ];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `New Lone Star Total Wash quote: ${quote.name}`,
      html: `<h1>New quote request</h1><table>${rows.map(([label, value]) => `<tr><th align="left" valign="top" style="padding:6px 12px 6px 0">${htmlEscape(label)}</th><td style="padding:6px 0">${htmlEscape(value)}</td></tr>`).join("")}</table>`,
      reply_to: quote.email || undefined,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`NOTIFY_${response.status}`);
  return { configured: true };
}

async function handleQuote(request, response) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return sendJson(response, 403, { error: "Origin not allowed" });
  if (rateLimited(request)) return sendJson(response, 429, { error: "Too many requests. Please wait before trying again." });

  let input;
  try {
    input = await readJson(request);
  } catch (error) {
    return sendJson(response, error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400, { error: "Invalid request" });
  }
  const quote = quotePayload(input);
  if (quote.companyWebsite) return sendJson(response, 200, { ok: true });
  const validationError = validateQuote(quote);
  if (validationError) return sendJson(response, 400, { error: validationError });

  const requestId = randomUUID();
  try {
    const saved = await saveToSupabase(quote) || await saveToUpstream(quote);
    if (!saved) throw new Error("NO_LEAD_DESTINATION");
  } catch (error) {
    console.error(JSON.stringify({ event: "quote_save_failed", requestId, reason: error.message }));
    return sendJson(response, 502, { error: "Quote delivery is temporarily unavailable. Please call or text Travis." });
  }

  try {
    await sendNotification(quote, requestId);
  } catch (error) {
    console.error(JSON.stringify({ event: "quote_notification_failed", requestId, reason: error.message }));
  }
  console.info(JSON.stringify({ event: "quote_saved", requestId, source: quote.source, notified: Boolean(process.env.RESEND_API_KEY && process.env.QUOTE_NOTIFICATION_TO) }));
  return sendJson(response, 200, { ok: true, requestId });
}

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^([.][.][/\\])+/, "");
  const relative = normalized.endsWith("/") ? `${normalized}index.html` : normalized;
  const filePath = join(root, relative);
  return filePath.startsWith(root) ? filePath : null;
}

async function staticFile(pathname, request, response) {
  const redirect = legacyRedirects.get(pathname);
  if (redirect) {
    response.writeHead(301, { location: redirect, ...securityHeaders() });
    return response.end();
  }

  let filePath = safeFilePath(pathname);
  if (!filePath) return sendJson(response, 400, { error: "Invalid path" });
  try {
    const details = await stat(filePath);
    if (details.isDirectory()) filePath = join(filePath, "index.html");
    await access(filePath);
  } catch {
    filePath = join(root, "404", "index.html");
    response.statusCode = 404;
  }

  const extension = extname(filePath).toLowerCase();
  const cacheControl = [".jpg", ".jpeg", ".png", ".svg", ".css", ".js"].includes(extension) ? "public, max-age=604800, stale-while-revalidate=86400" : "public, max-age=0, must-revalidate";
  const details = await stat(filePath);
  response.writeHead(response.statusCode || 200, {
    ...securityHeaders(mimeTypes[extension] || "application/octet-stream"),
    "cache-control": cacheControl,
    "content-length": details.size,
  });
  if (request.method === "HEAD") return response.end();
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const started = performance.now();
  const url = new URL(request.url || "/", "http://localhost");
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return sendJson(response, 200, { ok: true, service: "lonestar-total-wash" });
    if (request.method === "POST" && url.pathname === "/api/quote") return await handleQuote(request, response);
    if (request.method === "GET" || request.method === "HEAD") return await staticFile(url.pathname, request, response);
    response.setHeader("allow", "GET, HEAD, POST");
    return sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(JSON.stringify({ event: "request_failed", path: url.pathname, reason: error.message }));
    if (!response.headersSent) sendJson(response, 500, { error: "Internal server error" });
    else response.end();
  } finally {
    const durationMs = Math.round(performance.now() - started);
    if (url.pathname !== "/api/quote") console.info(JSON.stringify({ event: "request", method: request.method, path: url.pathname, status: response.statusCode, durationMs }));
  }
});

server.listen(port, host, () => console.info(JSON.stringify({ event: "server_started", host, port })));

function shutdown(signal) {
  console.info(JSON.stringify({ event: "server_stopping", signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
