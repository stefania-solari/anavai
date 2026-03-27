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
