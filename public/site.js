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

const quoteForm = document.querySelector("[data-quote-form]");
if (quoteForm) {
  const city = quoteForm.querySelector("[data-city]");
  const requestedCity = new URLSearchParams(window.location.search).get("city");
  if (city && requestedCity) city.value = requestedCity.slice(0, 80);

  quoteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = quoteForm.querySelector("[data-submit]");
    const error = quoteForm.querySelector("[data-form-error]");
    const success = quoteForm.querySelector("[data-form-success]");
    const fields = quoteForm.querySelector("[data-form-fields]");
    error.hidden = true;
    if (!quoteForm.reportValidity()) return;

    const data = new FormData(quoteForm);
    const params = new URLSearchParams(window.location.search);
    const payload = {
      name: data.get("name"),
      phone: data.get("phone"),
      email: data.get("email"),
      address: data.get("address"),
      city: data.get("city"),
      services: data.getAll("services"),
      message: data.get("message"),
      companyWebsite: data.get("companyWebsite"),
      consent: data.get("consent") === "on",
      source: (params.get("utm_source") || "website").slice(0, 50),
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
