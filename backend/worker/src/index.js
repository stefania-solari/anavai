const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function resolveAllowedOrigin(request, env) {
  const reqOrigin = request.headers.get("origin") || "";
  const raw = (env.ALLOWED_ORIGINS || "").trim();
  if (!raw) return reqOrigin || "*";
  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.includes("*")) return reqOrigin || "*";
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
  return allowed[0] || "*";
}

function corsHeaders(origin = "*") {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function sanitizeString(value, maxLen = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 16000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function geocodeCity(query) {
  const base = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&format=json`;
  const [enRes, itRes, neutralRes] = await Promise.all([
    fetchJsonWithTimeout(`${base}&language=en`, {}, 12000).catch(() => ({ results: [] })),
    fetchJsonWithTimeout(`${base}&language=it`, {}, 12000).catch(() => ({ results: [] })),
    fetchJsonWithTimeout(base, {}, 12000).catch(() => ({ results: [] })),
  ]);
  const allRows = [
    ...(Array.isArray(enRes?.results) ? enRes.results : []),
    ...(Array.isArray(itRes?.results) ? itRes.results : []),
    ...(Array.isArray(neutralRes?.results) ? neutralRes.results : []),
  ];
  const seen = new Set();
  const rows = allRows.filter((r) => {
    const key = `${r.name || ""}|${r.country || ""}|${r.admin1 || ""}|${r.latitude}|${r.longitude}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const mapped = rows.map((r) => ({
    name: r.name || "",
    country: r.country || "",
    admin1: r.admin1 || "",
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    population: Number(r.population || 0),
    timezone: r.timezone || "",
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  }));
  const qNorm = String(query || "").trim().toLowerCase();
  mapped.sort((a, b) => {
    const aExact = a.name.toLowerCase() === qNorm ? 1 : 0;
    const bExact = b.name.toLowerCase() === qNorm ? 1 : 0;
    const popDiff = (b.population || 0) - (a.population || 0);
    if (popDiff !== 0) return popDiff;
    return bExact - aExact;
  });
  return mapped;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function buildAroundClauses(type, lat, lon, radius, filter, includeAreas = false) {
  const parts = [`${type}(around:${radius},${lat},${lon})${filter};`];
  if (includeAreas) {
    parts.push(`way(around:${radius},${lat},${lon})${filter};`);
    parts.push(`relation(around:${radius},${lat},${lon})${filter};`);
  }
  return parts.join("\n");
}

function overpassQuery({ body, timeout = 20, out = "center", limit = null }) {
  const outClause = limit ? `out ${out} ${Number(limit)};` : `out ${out};`;
  return `[out:json][timeout:${timeout}];(${body});${outClause}`;
}

async function fetchOverpass(body, timeoutMs = 26000) {
  let lastErr = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchJsonWithTimeout(endpoint, { method: "POST", body }, timeoutMs);
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      return elements;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Overpass request failed");
}

function mapOsmElements(elements, fallbackLabel) {
  const seen = new Set();
  const mapped = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const name =
      sanitizeString(tags.name || "", 180) ||
      sanitizeString(tags.operator || "", 180) ||
      `${fallbackLabel} #${String(el.id || "").slice(-5)}`;
    const key = `${name.toLowerCase()}-${Math.round((el.lat || el.center?.lat || 0) * 1000)}-${Math.round((el.lon || el.center?.lon || 0) * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mapped.push({
      name,
      category: tags.shop || tags.craft || tags.amenity || tags.man_made || fallbackLabel,
      address: sanitizeString(
        [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(" "),
        240
      ),
      lat: Number(el.lat || el.center?.lat || 0),
      lon: Number(el.lon || el.center?.lon || 0),
      osm_id: el.id,
      osm_type: el.type,
    });
  }
  return mapped;
}

function generatedFallback(city, type) {
  const base = city?.name || "Selected city";
  if (type === "producer") {
    return [
      { name: `${base} artisan studios`, category: "producer", address: "", lat: city.latitude, lon: city.longitude },
      { name: `${base} independent makers`, category: "producer", address: "", lat: city.latitude, lon: city.longitude },
    ];
  }
  if (type === "product") {
    return [
      { name: `${base} interior suppliers`, category: "product", address: "", lat: city.latitude, lon: city.longitude },
      { name: `${base} home decor stores`, category: "product", address: "", lat: city.latitude, lon: city.longitude },
    ];
  }
  return [
    { name: `${base} central market area`, category: "market", address: "", lat: city.latitude, lon: city.longitude },
    { name: `${base} local trade district`, category: "market", address: "", lat: city.latitude, lon: city.longitude },
  ];
}

async function citySearch(query) {
  const candidates = await geocodeCity(query);
  if (!candidates.length) {
    return {
      city: null,
      alternatives: [],
      producers: [],
      products: [],
      markets: [],
    };
  }
  const city = candidates[0];
  const lat = city.latitude;
  const lon = city.longitude;
  const radius = 9000;

  const marketsNodesQ = overpassQuery({
    timeout: 16,
    body: buildAroundClauses("node", lat, lon, radius, `["amenity"="marketplace"]`),
  });
  const marketsAreasQ = overpassQuery({
    timeout: 20,
    body: `${buildAroundClauses("way", lat, lon, radius, `["amenity"="marketplace"]`)}\n${buildAroundClauses(
      "relation",
      lat,
      lon,
      radius,
      `["amenity"="marketplace"]`
    )}`,
  });

  const producersNodesQ = overpassQuery({
    timeout: 16,
    body: `
    ${buildAroundClauses("node", lat, lon, radius, `["craft"]`)}
    ${buildAroundClauses("node", lat, lon, radius, `["man_made"="works"]`)}
    ${buildAroundClauses("node", lat, lon, radius, `["shop"="craft"]`)}
    `,
  });
  const producersAreasQ = overpassQuery({
    timeout: 22,
    body: `
    ${buildAroundClauses("way", lat, lon, radius, `["craft"]`)}
    ${buildAroundClauses("relation", lat, lon, radius, `["craft"]`)}
    ${buildAroundClauses("way", lat, lon, radius, `["man_made"="works"]`)}
    `,
  });

  const productsNodesQ = overpassQuery({
    timeout: 16,
    body: `
    ${buildAroundClauses(
      "node",
      lat,
      lon,
      radius,
      `["shop"~"furniture|home_goods|department_store|interior_decoration|fabric|curtain|carpet|paint|lighting|antiques|art|tiles|doityourself|hardware|gift"]`
    )}
    `,
  });
  const productsAreasQ = overpassQuery({
    timeout: 22,
    body: `
    ${buildAroundClauses(
      "way",
      lat,
      lon,
      radius,
      `["shop"~"furniture|home_goods|department_store|interior_decoration|fabric|curtain|carpet|paint|lighting|antiques|art|tiles|doityourself|hardware|gift"]`
    )}
    ${buildAroundClauses(
      "relation",
      lat,
      lon,
      radius,
      `["shop"~"furniture|home_goods|department_store|interior_decoration|fabric|curtain|carpet|paint|lighting|antiques|art|tiles|doityourself|hardware|gift"]`
    )}
    `,
  });

  const [marketsNodes, producersNodes, productsNodes] = await Promise.all([
    fetchOverpass(marketsNodesQ).catch(() => []),
    fetchOverpass(producersNodesQ).catch(() => []),
    fetchOverpass(productsNodesQ).catch(() => []),
  ]);
  const [marketsAreas, producersAreas, productsAreas] = await Promise.all([
    marketsNodes.length < 10 ? fetchOverpass(marketsAreasQ).catch(() => []) : Promise.resolve([]),
    producersNodes.length < 20 ? fetchOverpass(producersAreasQ).catch(() => []) : Promise.resolve([]),
    productsNodes.length < 40 ? fetchOverpass(productsAreasQ).catch(() => []) : Promise.resolve([]),
  ]);

  const marketsRaw = [...marketsNodes, ...marketsAreas];
  const producersRaw = [...producersNodes, ...producersAreas];
  const productsRaw = [...productsNodes, ...productsAreas];

  const marketsMapped = mapOsmElements(marketsRaw, "market");
  const productsMapped = mapOsmElements(productsRaw, "product");
  const producersMapped = mapOsmElements(producersRaw, "producer");

  return {
    city,
    alternatives: candidates.slice(1, 6),
    producers: producersMapped.length ? producersMapped : generatedFallback(city, "producer"),
    products: productsMapped.length ? productsMapped : generatedFallback(city, "product"),
    markets:
      marketsMapped.length > 0
        ? marketsMapped
        : productsMapped
            .filter((p) => ["department_store", "home_goods", "interior_decoration"].includes(p.category))
            .length
            ? productsMapped
                .filter((p) => ["department_store", "home_goods", "interior_decoration"].includes(p.category))
            : generatedFallback(city, "market"),
  };
}

function normalizePayload(input) {
  const fields = typeof input?.fields === "object" && input.fields ? input.fields : {};
  const customer = typeof input?.customer === "object" && input.customer ? input.customer : {};
  const cartItems = Array.isArray(input?.cart_items) ? input.cart_items : [];

  const submittedAt = new Date(input?.submitted_at || Date.now());
  const submittedAtISO = Number.isNaN(submittedAt.getTime()) ? new Date().toISOString() : submittedAt.toISOString();

  return {
    source: sanitizeString(input?.source || "unknown", 120),
    submitted_at: submittedAtISO,
    client_type: sanitizeString(fields.client_type || "", 120),
    sample_requested: sanitizeString(fields.sample_requested || "", 20),
    email:
      sanitizeString(fields.email || customer.email || customer.email_address || "", 320).toLowerCase(),
    full_name:
      sanitizeString(
        fields.first_name && fields.last_name
          ? `${fields.first_name} ${fields.last_name}`
          : fields.first_name || fields.last_name || "",
        220
      ) || sanitizeString(customer.first_name || "", 120),
    phone: sanitizeString(fields.phone_optional || fields.phone || customer.phone || "", 80),
    location: sanitizeString(fields.location || fields.city || customer.location || "", 120),
    country: sanitizeString(fields.country || customer.country || "", 80),
    budget: sanitizeString(fields.approx_budget || fields.budget || "", 120),
    message: sanitizeString(fields.your_message || fields.project_details || input?.note || "", 4000),
    currency: sanitizeString(input?.currency || "EUR", 10),
    cart_total: Number(input?.cart_total || 0),
    cart_items: cartItems.slice(0, 50).map((item) => ({
      item_id: sanitizeString(item?.item_id || "", 120),
      item_name: sanitizeString(item?.item_name || "", 240),
      item_variant: sanitizeString(item?.item_variant || "", 240),
      quantity: Number(item?.quantity || 0),
      price: Number(item?.price || 0),
    })),
    raw: input,
  };
}

function validateLead(lead) {
  if (!lead.email || !lead.email.includes("@")) {
    return "A valid email is required";
  }
  if (!lead.source) {
    return "Source is required";
  }
  return "";
}

async function saveToSupabase(env, lead) {
  const table = env.SUPABASE_TABLE || "enquiries";
  const url = `${env.SUPABASE_URL}/rest/v1/${table}`;
  const apiKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!apiKey) {
    throw new Error("Missing SUPABASE key (set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY)");
  }
  const payload = {
    source: lead.source,
    submitted_at: lead.submitted_at,
    email: lead.email,
    full_name: lead.full_name,
    phone: lead.phone,
    location: lead.location || "",
    country: lead.country,
    client_type: lead.client_type,
    sample_requested: lead.sample_requested,
    budget: lead.budget,
    message: lead.message,
    currency: lead.currency,
    cart_total: lead.cart_total,
    cart_items: lead.cart_items,
    raw_payload: lead.raw,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: apiKey,
      authorization: `Bearer ${apiKey}`,
      prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  const rows = await res.json();
  return rows?.[0] || null;
}

async function sendEmail(env, lead) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_TO) return { skipped: true };
  const lineItems =
    lead.cart_items.length === 0
      ? "No cart items"
      : lead.cart_items
          .map((i) => `- ${i.item_name || i.item_id} x${i.quantity} (${i.price} ${lead.currency})`)
          .join("\n");

  const bodyText = [
    `New enquiry (${lead.source})`,
    `Email: ${lead.email}`,
    `Name: ${lead.full_name || "-"}`,
    `Phone: ${lead.phone || "-"}`,
    `Location: ${lead.location || "-"}`,
    `Country: ${lead.country || "-"}`,
    `Client type: ${lead.client_type || "-"}`,
    `Budget: ${lead.budget || "-"}`,
    `Sample requested: ${lead.sample_requested || "-"}`,
    `Cart total: ${lead.cart_total} ${lead.currency}`,
    "",
    "Cart items:",
    lineItems,
    "",
    "Message:",
    lead.message || "-",
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || "Anavai Enquiries <noreply@updates.anavai.com>",
      to: [env.NOTIFY_TO],
      subject: `New enquiry: ${lead.email}`,
      text: bodyText,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${res.status} ${err}`);
  }
  return { skipped: false };
}

export default {
  async fetch(request, env) {
    const origin = resolveAllowedOrigin(request, env);
    const cors = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, service: "anavai-enquiry-worker" }, 200, cors);
    }

    if (request.method === "GET" && url.pathname === "/api/city-search") {
      const q = sanitizeString(url.searchParams.get("q") || "", 120);
      if (q.length < 2) {
        return json({ ok: false, error: "Query must be at least 2 characters" }, 400, cors);
      }
      try {
        const results = await citySearch(q);
        return json({ ok: true, query: q, ...results }, 200, cors);
      } catch (err) {
        return json({ ok: false, error: err?.message || "Search failed" }, 500, cors);
      }
    }

    if (request.method !== "POST" || url.pathname !== "/api/enquiry") {
      return json({ ok: false, error: "Not found" }, 404, cors);
    }

    try {
      const body = await request.json();

      // Honeypot support: if present and non-empty, silently accept to reduce bot retries.
      if (sanitizeString(body?.hp || "", 500)) {
        return json({ ok: true, mode: "honeypot" }, 200, cors);
      }

      const lead = normalizePayload(body);
      const validationError = validateLead(lead);
      if (validationError) {
        return json({ ok: false, error: validationError }, 400, cors);
      }

      const saved = await saveToSupabase(env, lead);
      await sendEmail(env, lead);

      return json(
        {
          ok: true,
          mode: "endpoint",
          id: saved?.id || null,
        },
        200,
        cors
      );
    } catch (err) {
      return json({ ok: false, error: err?.message || "Unexpected error" }, 500, cors);
    }
  },
};
