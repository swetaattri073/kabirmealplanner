/**
 * Floating LittleBowl chat assistant
 * Requires window.LITTLEBOWL_CHAT = { toddlerId, toddlerName }
 */
(function () {
  const cfg = window.LITTLEBOWL_CHAT;
  if (!cfg || !cfg.toddlerId) return;

  const TIPS = [
    () => "Need help navigating the app?",
    (name) => `What did ${name} eat today?`,
    (name) => `Any concerns about ${name}'s diet?`,
    () => "Find all the diet and nutrition related answers here.",
  ];

  let open = false;
  let tipIndex = 0;
  let busy = false;
  let messages = [];
  let tipTimer = null;

  const dock = document.createElement("div");
  dock.className = "lb-chat-fab-dock";
  dock.innerHTML = `
    <div class="lb-chat-tip" id="lb-chat-tip"></div>
    <button type="button" class="lb-chat-fab" id="lb-chat-fab" aria-label="Open chat assistant" aria-expanded="false">
      <i class="fas fa-comments"></i>
    </button>
  `;
  document.body.appendChild(dock);

  const tipEl = document.getElementById("lb-chat-tip");
  const fab = document.getElementById("lb-chat-fab");

  function renderTip() {
    const name = cfg.toddlerName || "your little one";
    tipEl.textContent = TIPS[tipIndex](name);
    tipEl.style.display = open ? "none" : "block";
    // retrigger animation
    tipEl.style.animation = "none";
    void tipEl.offsetWidth;
    tipEl.style.animation = "";
  }

  function startTips() {
    stopTips();
    tipTimer = setInterval(() => {
      tipIndex = (tipIndex + 1) % TIPS.length;
      renderTip();
    }, 4000);
  }

  function stopTips() {
    if (tipTimer) clearInterval(tipTimer);
    tipTimer = null;
  }

  let overlay = null;

  function ensurePanel() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "lb-chat-overlay";
    overlay.innerHTML = `
      <div class="lb-chat-panel" role="dialog" aria-label="LittleBowl chat assistant">
        <div class="lb-chat-panel-header">
          <div>
            <p class="lb-chat-panel-title">Ask about ${escapeHtml(cfg.toddlerName)}'s food</p>
            <p class="lb-chat-panel-sub">Diet, nutrition, and navigating LittleBowl</p>
          </div>
          <button type="button" class="lb-chat-close" id="lb-chat-close" aria-label="Close chat">×</button>
        </div>
        <div id="lb-chat-status"></div>
        <div class="lb-chat-messages" id="lb-chat-messages"></div>
        <div class="lb-chat-composer">
          <input id="lb-chat-input" type="text" placeholder="Ask about diet, meals, or the app…" />
          <button type="button" id="lb-chat-send">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeChat();
    });
    document.getElementById("lb-chat-close").addEventListener("click", closeChat);
    document.getElementById("lb-chat-send").addEventListener("click", sendMessage);
    document.getElementById("lb-chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
    return overlay;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMessages() {
    const box = document.getElementById("lb-chat-messages");
    if (!box) return;
    if (!messages.length) {
      box.innerHTML = `<div class="lb-chat-bubble assistant">No messages yet — try "what's the plan for today?" or "is honey okay for a toddler?"</div>`;
      return;
    }
    box.innerHTML = messages
      .map((m) => `<div class="lb-chat-bubble ${m.role}">${escapeHtml(m.content)}</div>`)
      .join("");
    if (busy) {
      box.innerHTML += `<div class="lb-chat-bubble assistant">Thinking...</div>`;
    }
    box.scrollTop = box.scrollHeight;
  }

  async function checkHealth() {
    const status = document.getElementById("lb-chat-status");
    try {
      const res = await fetch("/api/chat/health");
      const data = await res.json();
      if (!data.ok) {
        status.innerHTML = `<div class="lb-chat-warning">Chat isn't configured yet. Add <code>OPENAI_API_KEY</code> to the server <code>.env</code> and restart the app.</div>`;
        document.getElementById("lb-chat-input").disabled = true;
        document.getElementById("lb-chat-send").disabled = true;
      } else {
        status.innerHTML = "";
        document.getElementById("lb-chat-input").disabled = false;
        document.getElementById("lb-chat-send").disabled = false;
      }
    } catch (err) {
      status.innerHTML = `<div class="lb-chat-warning">Could not reach chat service.</div>`;
    }
  }

  async function sendMessage() {
    const input = document.getElementById("lb-chat-input");
    const text = (input.value || "").trim();
    if (!text || busy) return;
    input.value = "";
    messages.push({ role: "user", content: text });
    busy = true;
    renderMessages();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toddler_id: cfg.toddlerId,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Chat failed (${res.status})`);
      const reply = (data.message && data.message.content) || "Got it.";
      messages.push({ role: "assistant", content: reply });
      const planTools = (data.tool_results || []).filter((t) => t.tool === "update_weekly_plan");
      if (planTools.length && typeof showToast === "function") {
        const results = planTools.map((t) => t.result || {});
        const updatedCount = results.reduce((n, r) => n + ((r.updated && r.updated.length) || 0), 0);
        const skipped = results.flatMap((r) => r.skipped || []);
        const weeks = [...new Set(results.flatMap((r) => r.weeks_touched || []))];
        if (updatedCount > 0) {
          const weekHint = weeks.length ? ` Open week of ${weeks[0]}.` : "";
          showToast(
            `Weekly plan updated (${updatedCount} slot${updatedCount === 1 ? "" : "s"}).${weekHint}`,
            "success"
          );
          if (typeof loadWeeklyPlan === "function" && cfg.toddlerId) {
            loadWeeklyPlan(cfg.toddlerId, weeks[0] || null);
          }
        } else {
          const reason = (skipped[0] && skipped[0].reason) || "No matching future unlogged slots.";
          showToast(`Plan not changed: ${reason}`, "error");
        }
      }
    } catch (err) {
      messages.push({ role: "assistant", content: err.message || "Something went wrong." });
    } finally {
      busy = false;
      renderMessages();
    }
  }

  function openChat() {
    open = true;
    stopTips();
    renderTip();
    fab.classList.add("is-open");
    fab.setAttribute("aria-expanded", "true");
    fab.innerHTML = "×";
    fab.setAttribute("aria-label", "Close chat");
    ensurePanel();
    overlay.style.display = "flex";
    renderMessages();
    checkHealth();
    setTimeout(() => document.getElementById("lb-chat-input")?.focus(), 50);
  }

  function closeChat() {
    open = false;
    fab.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = '<i class="fas fa-comments"></i>';
    fab.setAttribute("aria-label", "Open chat assistant");
    if (overlay) overlay.style.display = "none";
    renderTip();
    startTips();
  }

  fab.addEventListener("click", () => {
    if (open) closeChat();
    else openChat();
  });

  renderTip();
  startTips();
})();
