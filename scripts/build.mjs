import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homePage, servicesPage, servicePage, pricingPage, workPage, serviceAreasPage, areaLandingPage, guidesPage, guidePage, quotePage, privacyPage, notFoundPage } from "../src/pages.mjs";
import { services, areaLandingPages, guides, site } from "../src/site.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(root, "public"), dist, { recursive: true });

const pages = new Map([
  ["/", homePage()],
  ["/services/", servicesPage()],
  ["/pricing/", pricingPage()],
  ["/work/", workPage()],
  ["/service-areas/", serviceAreasPage()],
  ["/guides/", guidesPage()],
  ["/quote/", quotePage()],
  ["/privacy/", privacyPage()],
  ["/404/", notFoundPage()],
]);

for (const service of services) pages.set(`/services/${service.slug}/`, servicePage(service));
for (const area of areaLandingPages) pages.set(`/service-areas/${area.slug}/`, areaLandingPage(area));
for (const guide of guides) pages.set(`/guides/${guide.slug}/`, guidePage(guide));

for (const [route, html] of pages) {
  const file = route === "/" ? join(dist, "index.html") : join(dist, route, "index.html");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

const sitemapRoutes = [...pages.keys()].filter((route) => route !== "/404/");
const lastModified = "2026-09-24";
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapRoutes.map((route) => `  <url><loc>${site.url}${route === "/" ? "/" : route}</loc><lastmod>${lastModified}</lastmod><changefreq>${route.startsWith("/guides/") ? "monthly" : "weekly"}</changefreq><priority>${route === "/" ? "1.0" : route === "/quote/" || route.startsWith("/service-areas/") ? "0.9" : "0.8"}</priority></url>`).join("\n")}
</urlset>`;

await writeFile(join(dist, "sitemap.xml"), sitemap);
await writeFile(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${site.url}/sitemap.xml\n`);
await writeFile(join(dist, "site.webmanifest"), JSON.stringify({ name: site.name, short_name: "Lone Star Wash", start_url: "/", display: "standalone", background_color: "#f7f3ea", theme_color: "#0a2d4f", icons: [{ src: "/images/brand/favicon.png", sizes: "256x256", type: "image/png" }] }, null, 2));

console.log(`Built ${pages.size} pages in ${dist}`);
