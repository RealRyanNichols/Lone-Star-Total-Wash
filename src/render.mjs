import { site } from "./site.mjs";

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function icon(name, className = "icon") {
  const paths = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.9Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
  };
  return `<svg class="${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.check}</svg>`;
}

export function button(href, label, variant = "primary", extra = "") {
  return `<a class="button button--${variant}" href="${escapeHtml(href)}" ${extra}>${escapeHtml(label)} ${icon("arrow", "button__icon")}</a>`;
}

export function callButton(label = `Call or text ${site.phoneDisplay}`, variant = "primary") {
  return `<a class="button button--${variant}" href="tel:${site.phoneHref}">${icon("phone", "button__icon")} ${escapeHtml(label)}</a>`;
}

export function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items
    .map(([label, href], index) => `<li>${href && index < items.length - 1 ? `<a href="${href}">${escapeHtml(label)}</a>` : `<span aria-current="page">${escapeHtml(label)}</span>`}</li>`)
    .join('<li aria-hidden="true">/</li>')}</ol></nav>`;
}

export function faqBlock(items, heading = "Questions people ask before booking") {
  return `<section class="section section--tight"><div class="container container--narrow"><div class="section-heading"><p class="eyebrow">Straight answers</p><h2>${escapeHtml(heading)}</h2></div><div class="faq-list">${items
    .map(([question, answer], index) => `<details ${index === 0 ? "open" : ""}><summary>${escapeHtml(question)}<span aria-hidden="true">+</span></summary><p>${escapeHtml(answer)}</p></details>`)
    .join("")}</div></div></section>`;
}

export function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function cta({ heading = "Let Travis look at the job.", text = "Tell us what needs washed, where it is, and the best way to reach you. The quote is free and there is no obligation." } = {}) {
  return `<section class="cta-band"><div class="container cta-band__inner"><div><p class="eyebrow eyebrow--light">Free quote. Clear next step.</p><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(text)}</p></div><div class="button-row">${button("/quote/", "Request a free quote", "light")}${callButton("Call or text Travis", "outline-light")}</div></div></section>`;
}

function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
    "@id": `${site.url}/#business`,
    name: site.name,
    url: site.url,
    telephone: site.phoneHref,
    image: `${site.url}/images/brand/logo.png`,
    logo: `${site.url}/images/brand/logo.png`,
    description: "Mobile fleet washing and pressure washing for commercial and residential customers across East Texas.",
    address: {
      "@type": "PostalAddress",
      addressLocality: site.locality,
      addressRegion: site.region,
      postalCode: site.postalCode,
      addressCountry: "US",
    },
    areaServed: site.areas.slice(0, -1).map((name) => ({ "@type": "City", name })),
    sameAs: [site.facebook, site.tiktok, site.googleMaps],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: site.phoneHref,
      contactType: "customer service",
      areaServed: "US-TX",
      availableLanguage: "English",
    },
    priceRange: "$$",
    paymentAccepted: "Cash, credit card, check, Cash App, Venmo",
  };
}

function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    url: `${site.url}/`,
    name: site.name,
    publisher: { "@id": `${site.url}/#business` },
    inLanguage: "en-US",
  };
}

function webPageSchema({ canonical, title, description, image }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    isPartOf: { "@id": `${site.url}/#website` },
    about: { "@id": `${site.url}/#business` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${site.url}${image}` },
    inLanguage: "en-US",
  };
}

function header() {
  return `<a class="skip-link" href="#main">Skip to content</a>
  <div class="utility"><div class="container utility__inner"><span>${icon("pin")} Hallsville-based. Mobile service across East Texas.</span><span>${icon("clock")} After-hours and weekends available.</span></div></div>
  <header class="site-header" data-header>
    <div class="container site-header__inner">
      <a class="brand" href="/" aria-label="Lone Star Total Wash home"><img src="/images/brand/logo.png" width="60" height="60" alt=""/><span><strong>Lone Star</strong><small>Total Wash</small></span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle><span class="sr-only">Open navigation</span>${icon("menu")}</button>
      <nav class="site-nav" id="site-nav" data-nav>
        <a href="/services/">Services</a>
        <a href="/work/">Our Work</a>
        <a href="/pricing/">Pricing</a>
        <a href="/service-areas/">Service Area</a>
        <a href="/guides/">Guides</a>
        <a class="site-nav__phone" href="tel:${site.phoneHref}">${icon("phone")} ${site.phoneDisplay}</a>
        <a class="button button--primary button--small" href="/quote/">Free Quote</a>
      </nav>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-grid"><div><a class="brand brand--footer" href="/"><img src="/images/brand/logo.png" width="72" height="72" alt=""/><span><strong>Lone Star</strong><small>Total Wash</small></span></a><p>Mobile fleet and pressure washing based in Hallsville, Texas, serving East Texas.</p><p class="footer-proof">Fully insured. We come to you.</p></div><div><h2>Services</h2><ul><li><a href="/services/fleet-washing/">Fleet washing</a></li><li><a href="/services/heavy-equipment-washing/">Heavy equipment</a></li><li><a href="/services/commercial-pressure-washing/">Commercial property</a></li><li><a href="/services/residential-pressure-washing/">Residential property</a></li></ul></div><div><h2>Plan the job</h2><ul><li><a href="/pricing/">Published base prices</a></li><li><a href="/work/">Completed work</a></li><li><a href="/service-areas/">Service area</a></li><li><a href="/guides/">Practical guides</a></li><li><a href="/review/">Share a review</a></li></ul></div><div><h2>Talk to Travis</h2><a class="footer-phone" href="tel:${site.phoneHref}">${site.phoneDisplay}</a><p>Call or text for a free quote.</p><div class="footer-social"><a href="${site.facebook}" target="_blank" rel="noopener">Facebook</a><a href="${site.tiktok}" target="_blank" rel="noopener">TikTok</a><a href="${site.googleMaps}" target="_blank" rel="noopener">Google</a></div></div></div><div class="container footer-bottom"><p>© 2026 Lone Star Total Wash. All rights reserved.</p><p>All work is subject to a written scope and contractor service agreement.</p></div></footer><div class="mobile-actions"><a href="tel:${site.phoneHref}">${icon("phone")} Call Travis</a><a href="/quote/">Free Quote ${icon("arrow")}</a></div>`;
}

export function page({ title, description, path = "/", body, image = "/images/jobs/tx-27.jpg", imageAlt = "Lone Star Total Wash mobile washing work in East Texas", schema = [], noindex = false }) {
  const canonical = `${site.url}${path === "/" ? "" : path}`;
  const schemas = [localBusinessSchema(), websiteSchema(), webPageSchema({ canonical, title, description, image }), ...schema];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="${noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" href="/images/brand/favicon.png" />
  <link rel="apple-touch-icon" href="/images/brand/favicon.png" />
  <meta name="theme-color" content="#0a2d4f" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="${site.name}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${site.url}${image}" />
  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="800" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${site.url}${image}" />
  <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />
  <link rel="preload" href="/styles.css" as="style" />
  <link rel="stylesheet" href="/styles.css" />
  ${schemas.map((item) => `<script type="application/ld+json">${JSON.stringify(item).replaceAll("<", "\\u003c")}</script>`).join("\n  ")}
</head>
<body>
  ${header()}
  <main id="main">${body}</main>
  ${footer()}
  <script src="/site.js" defer></script>
</body>
</html>`;
}
