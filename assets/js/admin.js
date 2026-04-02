import defaultConfig from "./anavai-config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

(function () {
  const cfg = { ...defaultConfig, ...(window.ANAVAI_CONFIG || {}) };
  const supabaseUrl = cfg.supabaseUrl || "";
  const supabaseAnonKey = cfg.supabaseAnonKey || "";

  const ui = {
    authBox: document.getElementById("adminAuth"),
    appBox: document.getElementById("adminApp"),
    email: document.getElementById("adminEmail"),
    sendBtn: document.getElementById("sendMagicLinkBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    refreshBtn: document.getElementById("refreshLeadsBtn"),
    statusFilter: document.getElementById("statusFilter"),
    queryFilter: document.getElementById("queryFilter"),
    tableBody: document.getElementById("enquiriesBody"),
    count: document.getElementById("enquiriesCount"),
    toast: document.getElementById("adminToast"),
    userEmail: document.getElementById("adminUserEmail"),
  };

  function showToast(msg) {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    ui.toast.classList.add("show");
    setTimeout(() => ui.toast.classList.remove("show"), 3000);
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    showToast("Missing Supabase config in anavai-config.js");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session || null;
  }

  async function sendMagicLink() {
    const email = (ui.email?.value || "").trim();
    if (!email || !email.includes("@")) {
      showToast("Insert a valid email");
      return;
    }
    ui.sendBtn.disabled = true;
    ui.sendBtn.textContent = "Sending...";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    ui.sendBtn.disabled = false;
    ui.sendBtn.textContent = "Send Magic Link";
    if (error) {
      showToast(`Auth error: ${error.message}`);
      return;
    }
    showToast("Magic link sent. Check your inbox.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    await updateAuthUI();
  }

  function renderRows(rows) {
    if (!ui.tableBody) return;
    ui.tableBody.innerHTML = rows
      .map((r) => {
        const created = r.created_at ? new Date(r.created_at).toLocaleString() : "-";
        const items = Array.isArray(r.cart_items) ? r.cart_items.length : 0;
        return `
          <tr>
            <td>${escapeHtml(created)}</td>
            <td>${escapeHtml(r.email || "-")}</td>
            <td>${escapeHtml(r.source || "-")}</td>
            <td>${escapeHtml(r.client_type || "-")}</td>
            <td>${escapeHtml(r.country || "-")}</td>
            <td>${escapeHtml(r.location || "-")}</td>
            <td>${escapeHtml(r.cart_total || 0)} ${escapeHtml(r.currency || "EUR")}</td>
            <td>${items}</td>
            <td>
              <select data-id="${r.id}" class="lead-status">
                ${["new", "qualified", "quoted", "won", "lost"]
                  .map((s) => `<option value="${s}" ${r.status === s ? "selected" : ""}>${s}</option>`)
                  .join("")}
              </select>
            </td>
            <td>${escapeHtml((r.message || "").slice(0, 80))}</td>
          </tr>
        `;
      })
      .join("");

    ui.tableBody.querySelectorAll(".lead-status").forEach((el) => {
      el.addEventListener("change", async (ev) => {
        const id = ev.target.getAttribute("data-id");
        const status = ev.target.value;
        const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);
        if (error) {
          showToast(`Update error: ${error.message}`);
          return;
        }
        showToast("Lead updated");
      });
    });
  }

  async function loadEnquiries() {
    const status = ui.statusFilter?.value || "all";
    const query = (ui.queryFilter?.value || "").trim().toLowerCase();
    let q = supabase
      .from("enquiries")
      .select("id,created_at,email,source,client_type,country,location,cart_total,currency,cart_items,status,message,raw_payload")
      .order("created_at", { ascending: false })
      .limit(500);
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      showToast(`Load error: ${error.message}`);
      return;
    }
    let rows = data || [];
    if (query) {
      rows = rows.filter((r) => {
        const hay = [
          r.email,
          r.country,
          r.location,
          r.message,
          r.client_type,
          r.source,
          JSON.stringify(r.raw_payload || {}),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }
    renderRows(rows);
    if (ui.count) ui.count.textContent = String(rows.length);
  }

  async function updateAuthUI() {
    const session = await getSession();
    const loggedIn = !!session;
    ui.authBox.style.display = loggedIn ? "none" : "block";
    ui.appBox.style.display = loggedIn ? "block" : "none";
    if (loggedIn) {
      ui.userEmail.textContent = session.user?.email || "";
      await loadEnquiries();
    }
  }

  ui.sendBtn?.addEventListener("click", sendMagicLink);
  ui.signOutBtn?.addEventListener("click", signOut);
  ui.refreshBtn?.addEventListener("click", loadEnquiries);
  ui.statusFilter?.addEventListener("change", loadEnquiries);
  ui.queryFilter?.addEventListener("input", loadEnquiries);

  supabase.auth.onAuthStateChange(() => {
    updateAuthUI().catch(() => {});
  });

  updateAuthUI().catch(() => {
    showToast("Unable to initialize admin");
  });
})();
