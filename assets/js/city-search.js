import defaultConfig from "./anavai-config.js";

(function () {
  const cfg = { ...defaultConfig, ...(window.ANAVAI_CONFIG || {}) };
  const endpoint = cfg.citySearchEndpoint || "/api/city-search";

  const ui = {
    form: document.getElementById("citySearchForm"),
    input: document.getElementById("citySearchInput"),
    btn: document.getElementById("citySearchBtn"),
    resultWrap: document.getElementById("citySearchResults"),
    meta: document.getElementById("citySearchMeta"),
    alternatives: document.getElementById("citySearchAlternatives"),
    producers: document.getElementById("cityProducers"),
    products: document.getElementById("cityProducts"),
    markets: document.getElementById("cityMarkets"),
    map: document.getElementById("cityMap"),
    status: document.getElementById("citySearchStatus"),
  };
  let map;
  let markerLayer;

  function iconByType(type) {
    const color =
      type === "producer" ? "#5c7a5e" : type === "product" ? "#c8974a" : "#b86540";
    return window.L?.divIcon({
      className: "city-marker",
      html: `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(44,42,38,0.25)"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  function initMap() {
    if (!ui.map || !window.L) return false;
    if (map) return true;
    map = window.L.map(ui.map, { scrollWheelZoom: false }).setView([41.9, 12.49], 11);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    markerLayer = window.L.layerGroup().addTo(map);
    return true;
  }

  function updateMap(city, producers, products, markets) {
    if (!initMap()) return;
    markerLayer.clearLayers();
    const points = [];

    function addRows(rows, type, label) {
      rows.forEach((r) => {
        if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon) || (r.lat === 0 && r.lon === 0)) return;
        const marker = window.L.marker([r.lat, r.lon], { icon: iconByType(type) });
        marker.bindPopup(
          `<strong>${escapeHtml(r.name)}</strong><br><small>${escapeHtml(label)}${r.address ? ` · ${escapeHtml(r.address)}` : ""}</small>`
        );
        markerLayer.addLayer(marker);
        points.push([r.lat, r.lon]);
      });
    }

    addRows(producers, "producer", "Producer");
    addRows(products, "product", "Product");
    addRows(markets, "market", "Market");
    if (city?.latitude && city?.longitude) points.push([city.latitude, city.longitude]);

    if (points.length) {
      map.fitBounds(window.L.latLngBounds(points), { padding: [30, 30], maxZoom: 13 });
    } else if (city?.latitude && city?.longitude) {
      map.setView([city.latitude, city.longitude], 11);
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderList(el, title, rows) {
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = `<p class="city-list-empty">No ${title.toLowerCase()} found nearby.</p>`;
      return;
    }
    el.innerHTML = rows
      .map(
        (r) => `
      <article class="city-item">
        <h4>${escapeHtml(r.name)}</h4>
        <p class="city-item-meta">${escapeHtml(r.category || title)}</p>
        ${r.address ? `<p class="city-item-addr">${escapeHtml(r.address)}</p>` : ""}
      </article>
    `
      )
      .join("");
  }

  function setStatus(msg, isErr = false) {
    if (!ui.status) return;
    ui.status.textContent = msg;
    ui.status.style.color = isErr ? "var(--terracotta)" : "var(--muted)";
  }

  async function doSearch(q) {
    ui.btn.disabled = true;
    ui.btn.textContent = "Searching...";
    setStatus("Searching city data...");
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Search failed");
      }

      ui.resultWrap.style.display = "block";
      if (map) setTimeout(() => map.invalidateSize(), 80);
      const city = data.city;
      if (city) {
        ui.meta.textContent = `${city.label} · ${city.timezone || "timezone n/a"}`;
      } else {
        ui.meta.textContent = "No exact match found";
      }

      const alternatives = Array.isArray(data.alternatives) ? data.alternatives : [];
      ui.alternatives.innerHTML = alternatives.length
        ? alternatives
            .map(
              (a) =>
                `<button class="city-chip" type="button" data-city="${escapeHtml(a.label || a.name)}">${escapeHtml(
                  a.label || a.name
                )}</button>`
            )
            .join("")
        : "";
      ui.alternatives.querySelectorAll(".city-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          ui.input.value = chip.getAttribute("data-city");
          ui.form.requestSubmit();
        });
      });

      renderList(ui.producers, "Producers", data.producers || []);
      renderList(ui.products, "Products", data.products || []);
      renderList(ui.markets, "Markets", data.markets || []);
      updateMap(city, data.producers || [], data.products || [], data.markets || []);
      setStatus(
        `Found ${data.producers?.length || 0} producers, ${data.products?.length || 0} product points, ${data.markets?.length || 0} markets.`
      );
    } catch (err) {
      setStatus(err.message || "Search failed", true);
    } finally {
      ui.btn.disabled = false;
      ui.btn.textContent = "Search City";
    }
  }

  ui.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (ui.input?.value || "").trim();
    if (q.length < 2) {
      setStatus("Type at least 2 characters", true);
      return;
    }
    doSearch(q);
  });
})();
