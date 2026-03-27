/* ecommerce.js — tracking + enquiry transport layer (Shopify-ready baseline) */
import defaultConfig from "./anavai-config.js";

(function () {
  const config = { ...defaultConfig, ...(window.ANAVAI_CONFIG || {}) };
  window.dataLayer = window.dataLayer || [];

  function nowISO() {
    return new Date().toISOString();
  }

  function inferCurrency() {
    return config.currency || "EUR";
  }

  function inferPageType() {
    const p = window.location.pathname;
    if (p.endsWith("/index.html") || p === "/" || p === "") return "home";
    if (p.includes("/collections")) return "collection";
    if (p.includes("/contact")) return "contact";
    if (p.includes("/designers")) return "designers";
    if (p.includes("/hotels")) return "hotels";
    if (p.includes("/process")) return "process";
    return "page";
  }

  function track(eventName, payload) {
    const evt = {
      event: eventName,
      page_type: inferPageType(),
      ts: nowISO(),
      ...payload,
    };
    window.dataLayer.push(evt);
    return evt;
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
    }
    return res;
  }

  async function sendEnquiry(payload) {
    if (config.demoMode) {
      return { mode: "demo", ok: true };
    }
    const endpoint = config.enquiryEndpoint || "/api/enquiry";
    await postJSON(endpoint, payload);
    return { mode: "endpoint", ok: true };
  }

  window.anavaiEcom = {
    currency: inferCurrency(),
    track,
    sendEnquiry,
  };

  track("page_view", { path: window.location.pathname });
})();
