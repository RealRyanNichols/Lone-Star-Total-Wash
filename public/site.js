const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
  });
}

const filters = document.querySelector("[data-filters]");
const gallery = document.querySelector("[data-gallery]");
if (filters && gallery) {
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    const selected = button.dataset.filter;
    filters.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    gallery.querySelectorAll("figure").forEach((item) => {
      item.hidden = selected !== "all" && item.dataset.category !== selected;
    });
  });
}

const lightbox = document.querySelector("[data-lightbox]");
if (lightbox) {
  const image = lightbox.querySelector("[data-lightbox-image]");
  const caption = lightbox.querySelector("[data-lightbox-caption]");
  document.querySelectorAll("[data-gallery-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = button.querySelector("img");
      image.src = source.src;
      image.alt = source.alt;
      caption.textContent = source.alt;
      lightbox.showModal();
    });
  });
  lightbox.querySelector("[data-lightbox-close]").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

const fleetCalculator = document.querySelector("[data-fleet-calculator]");
if (fleetCalculator) {
  const type = fleetCalculator.querySelector("[data-fleet-type]");
  const count = fleetCalculator.querySelector("[data-fleet-count]");
  const total = fleetCalculator.querySelector("[data-fleet-total]");
  const summary = fleetCalculator.querySelector("[data-fleet-summary]");
  const quote = fleetCalculator.querySelector("[data-fleet-quote]");
  const update = () => {
    const units = Math.max(1, Math.min(500, Number.parseInt(count.value, 10) || 1));
    const rate = Number(type.value) || 0;
    const label = type.selectedOptions[0]?.dataset.label || "fleet units";
    total.textContent = formatCurrency(rate * units);
    summary.textContent = `${units.toLocaleString()} × ${label} at the published base rate`;
    const params = new URLSearchParams({ service: "fleet-washing", quantity: `${units} ${label}` });
    quote.href = `/quote/?${params.toString()}`;
  };
  type.addEventListener("change", update);
  count.addEventListener("input", update);
  update();
}

const flatworkCalculator = document.querySelector("[data-flatwork-calculator]");
if (flatworkCalculator) {
  const size = flatworkCalculator.querySelector("[data-flatwork-size]");
  const frequency = flatworkCalculator.querySelector("[data-flatwork-frequency]");
  const total = flatworkCalculator.querySelector("[data-flatwork-total]");
  const summary = flatworkCalculator.querySelector("[data-flatwork-summary]");
  const quote = flatworkCalculator.querySelector("[data-flatwork-quote]");
  const update = () => {
    const squareFeet = Math.max(1, Math.min(1000000, Number.parseInt(size.value, 10) || 1));
    const recurring = frequency.value === "recurring";
    const rate = squareFeet < 30000 ? (recurring ? 0.12 : 0.15) : squareFeet <= 100000 ? (recurring ? 0.10 : 0.12) : (recurring ? 0.08 : 0.10);
    total.textContent = formatCurrency(squareFeet * rate);
    summary.textContent = `${squareFeet.toLocaleString()} sq ft at ${Math.round(rate * 100)}¢ per sq ft`;
    const params = new URLSearchParams({
      service: "commercial-pressure-washing",
      squareFeet: String(squareFeet),
      frequency: recurring ? "Recurring schedule" : "One-time wash",
    });
    quote.href = `/quote/?${params.toString()}`;
  };
  size.addEventListener("input", update);
  frequency.addEventListener("change", update);
  update();
}

const quoteForm = document.querySelector("[data-quote-form]");
if (quoteForm) {
  const city = quoteForm.querySelector("[data-city]");
  const params = new URLSearchParams(window.location.search);
  const requestedCity = params.get("city");
  if (city && requestedCity) city.value = requestedCity.slice(0, 80);
  const requestedService = params.get("service");
  const service = requestedService ? quoteForm.querySelector(`[data-service="${CSS.escape(requestedService)}"]`) : null;
  if (service) service.checked = true;
  const quantity = quoteForm.querySelector("[data-quantity]");
  const requestedQuantity = params.get("quantity");
  if (quantity && requestedQuantity) quantity.value = requestedQuantity.slice(0, 40);
  const squareFeet = quoteForm.querySelector("[data-square-feet]");
  const requestedSquareFeet = params.get("squareFeet");
  if (squareFeet && requestedSquareFeet && /^\d{1,7}$/.test(requestedSquareFeet)) squareFeet.value = requestedSquareFeet;
  const frequency = quoteForm.querySelector("[data-frequency]");
  const requestedFrequency = params.get("frequency");
  if (frequency && [...frequency.options].some((option) => option.value === requestedFrequency)) frequency.value = requestedFrequency;

  quoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = quoteForm.querySelector("[data-submit]");
    const error = quoteForm.querySelector("[data-form-error]");
    const success = quoteForm.querySelector("[data-form-success]");
    const fields = quoteForm.querySelector("[data-form-fields]");
    error.hidden = true;
    if (!quoteForm.reportValidity()) return;

    const data = new FormData(quoteForm);
    const tracking = [params.get("utm_source"), params.get("utm_medium"), params.get("utm_campaign")].filter(Boolean).join("|");
    const payload = {
      name: data.get("name"),
      phone: data.get("phone"),
      email: data.get("email"),
      address: data.get("address"),
      city: data.get("city"),
      services: data.getAll("services"),
      quantity: data.get("quantity"),
      squareFeet: data.get("squareFeet"),
      frequency: data.get("frequency"),
      serviceWindow: data.get("serviceWindow"),
      message: data.get("message"),
      companyWebsite: data.get("companyWebsite"),
      consent: data.get("consent") === "on",
      source: (tracking || "website").slice(0, 120),
    };

    submit.disabled = true;
    submit.textContent = "Sending request...";
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("quote request failed");
      fields.hidden = true;
      success.hidden = false;
      success.focus();
    } catch {
      error.hidden = false;
      error.focus();
      submit.disabled = false;
      submit.textContent = "Send my free quote request";
    }
  });
}
