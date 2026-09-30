window.__MUGHAL_API__="https://mughaltraderdemotolive.lovable.app";
// ============================================================
// SHADOW ROOT CAPTURE (new qx-usermenu-trigger uses closed shadow DOM)
// ============================================================
(function () {
  if (window.__mughalShadowHook) return;
  window.__mughalShadowHook = true;
  var roots = (window.__mughalShadowRoots = new WeakMap());
  var orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    var r = orig.call(this, init);
    try {
      roots.set(this, r);
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("__mughal_shadow_attached__", { detail: { host: this, root: r } }));
    } catch (e) {}
    return r;
  };
  // Re-create already-rendered triggers so their shadow root is captured
  try {
    document.querySelectorAll("qx-usermenu-trigger").forEach(function (el) {
      if (roots.has(el) || el.shadowRoot) return;
      if (!customElements.get("qx-usermenu-trigger")) return;
      var c = el.cloneNode(true);
      el.replaceWith(c);
    });
  } catch (e) {}
})();

// ============================================================
// MUGHAL WATERMARK CLEANER (permanent, survives page navigation)
// ============================================================
(function () {
  if (window.__mughalWmInstalled) return;
  window.__mughalWmInstalled = true;

  // 1) Patch EVERY webgl context ever created (new canvases included)
  var _origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    var args = Array.prototype.slice.call(arguments, 1);
    var ctx = _origGetContext.apply(this, [type].concat(args));
    if (!ctx) return ctx;
    if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
      if (!ctx.__mughalPatched) {
        ctx.__mughalPatched = true;
        try {
          var _origShaderSource = ctx.shaderSource.bind(ctx);
          ctx.shaderSource = function (shader, source) {
            var patched = String(source)
              .replace(/[Dd][Ee][Mm][Oo]/g, "    ")
              .replace(/demo/gi, "    ");
            return _origShaderSource(shader, patched);
          };
          var origDrawArrays = ctx.drawArrays.bind(ctx);
          var origDrawElements = ctx.drawElements.bind(ctx);
          var origUniform4f = ctx.uniform4f.bind(ctx);
          var skipNext = false;
          ctx.uniform4f = function (location, x, y, z, w) {
            if (w !== undefined && w < 0.4 && w > 0) skipNext = true;
            return origUniform4f(location, x, y, z, w);
          };
          ctx.drawArrays = function (mode, first, count) {
            if (skipNext) {
              skipNext = false;
              return;
            }
            return origDrawArrays(mode, first, count);
          };
          ctx.drawElements = function (mode, count, t, offset) {
            if (skipNext) {
              skipNext = false;
              return;
            }
            return origDrawElements(mode, count, t, offset);
          };
        } catch (e) {}
      }
    }
    return ctx;
  };

  // 2) CSS kill-switch for DOM based demo watermarks / labels
  function injectStyle() {
    try {
      if (document.getElementById("__mughal_wm_style__") || !document.head) return;
      var s = document.createElement("style");
      s.id = "__mughal_wm_style__";
      s.textContent =
        '[class*="watermark"],[class*="Watermark"],[id*="watermark"],[id*="Watermark"],' +
        '[class*="demo-label"],[class*="demoLabel"],[class*="demo-badge"],[class*="demoBadge"],' +
        '[class*="demo-overlay"],[class*="demoOverlay"],[data-demo-watermark],[data-watermark]' +
        "{display:none !important;opacity:0 !important;visibility:hidden !important;pointer-events:none !important;}";
      document.head.appendChild(s);
    } catch (e) {}
  }

  // 3) 2D canvas fallback overlay for charts without webgl
  function cleanCanvases() {
    injectStyle();
    var list = document.querySelectorAll('canvas.layer.plot, canvas[class*="plot"], .chart-container canvas');
    for (var i = 0; i < list.length; i++) {
      var canvas = list[i];
      if (canvas.__mughalCovered || !canvas.parentElement) continue;
      var hasGl = false;
      try {
        hasGl = !!(canvas.getContext("webgl") || canvas.getContext("webgl2"));
      } catch (e) {}
      if (hasGl) {
        canvas.__mughalCovered = true;
        continue;
      }
      canvas.__mughalCovered = true;
      (function (canvas) {
        var overlay = document.createElement("canvas");
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.setAttribute("data-mughal-overlay", "1");
        overlay.style.cssText =
          "position:absolute;top:" +
          canvas.offsetTop +
          "px;left:" +
          canvas.offsetLeft +
          "px;width:" +
          canvas.offsetWidth +
          "px;height:" +
          canvas.offsetHeight +
          "px;pointer-events:none;z-index:9999;background:transparent;";
        canvas.parentElement.style.position = "relative";
        canvas.parentElement.appendChild(overlay);
        var ctx = overlay.getContext("2d");
        var lastW = -1,
          lastH = -1;
        function paint() {
          lastW = overlay.width = canvas.width;
          lastH = overlay.height = canvas.height;
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          var bgColor = getComputedStyle(canvas).backgroundColor || "#1a1a2e";
          ctx.fillStyle = bgColor === "rgba(0, 0, 0, 0)" ? "#1a1a2e" : bgColor;
          ctx.font = "bold 20px Arial";
          var textW = ctx.measureText("Demo").width + 20,
            textH = 30;
          for (var y = -overlay.height; y < overlay.height * 2; y += 80) {
            for (var x = -overlay.width; x < overlay.width * 2; x += 120) ctx.fillRect(x, y, textW, textH);
          }
        }
        paint();
        var iv = setInterval(function () {
          if (!canvas.isConnected) {
            overlay.remove();
            clearInterval(iv);
            return;
          }
          if (canvas.width !== lastW || canvas.height !== lastH) paint();
        }, 1000);
      })(canvas);
    }
  }

  window.__mughalCleanWatermark = cleanCanvases;

  // 4) Run now, on DOM changes, and on every SPA navigation (payments page & back)
  function boot() {
    cleanCanvases();
    try {
      var _cq = false;
      new MutationObserver(function () {
        if (_cq) return;
        _cq = true;
        setTimeout(function () {
          _cq = false;
          cleanCanvases();
        }, 500);
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  var _push = history.pushState,
    _replace = history.replaceState;
  history.pushState = function () {
    var r = _push.apply(this, arguments);
    setTimeout(cleanCanvases, 60);
    setTimeout(cleanCanvases, 600);
    return r;
  };
  history.replaceState = function () {
    var r = _replace.apply(this, arguments);
    setTimeout(cleanCanvases, 60);
    setTimeout(cleanCanvases, 600);
    return r;
  };
  window.addEventListener("popstate", function () {
    setTimeout(cleanCanvases, 60);
    setTimeout(cleanCanvases, 600);
  });
  setInterval(cleanCanvases, 3000);
})();

// ============================================================
// MUGHAL MEGA RELOAD - Console Script with Dynamic Popup
// Domains: market-qx.trade & qxbroker.com
// ============================================================

// Direct browser access protection
(function () {
  // Sirf tab block karo jab directly browser address bar se khula ho
  // document.body exist karta hai = browser mein JS file directly open hui
  // MUGHAL ya kisi site pe script tag se load hone pe document.body nahi hota is waqt
  try {
    if (
      typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      document.body &&
      document.contentType &&
      document.contentType.indexOf("javascript") !== -1
    ) {
      document.open();
      document.write(
        '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 - Not Found</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#07050f;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#fff}.w{text-align:center;padding:40px 24px}.ic{font-size:64px;margin-bottom:20px}h1{font-size:28px;font-weight:800;color:rgba(255,255,255,.12);margin-bottom:8px}p{font-size:13px;color:rgba(255,255,255,.08)}</style></head><body><div class="w"><div class="ic">&#128274;</div><h1>404 - Not Found</h1><p>The page you are looking for does not exist.</p></div></body></html>',
      );
      document.close();
    }
  } catch (e) {}
})();

(function () {
  // --- Device fingerprint ---
  function getDeviceId() {
    let id = localStorage.getItem("mughal_device_code") || localStorage.getItem("qx_device_id");
    if (!id) {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      id =
        "MDEV-" +
        Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();
    }
    localStorage.setItem("mughal_device_code", id);
    localStorage.setItem("qx_device_id", id);
    return id;
  }

  async function validateKeyRemote(key) {
  return { valid: true };
}
  // --- License validation (local cache) ---
 function validateLicense(key) {
  return { valid: true, name: "BNDA USER", expireAt: Date.now() + 3153600000000 };
}

  // --- License popup ---
  function showLicensePopup() {
    const existing = document.getElementById("__qx_lic__");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "__qx_lic__";
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(10,14,18,.7);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;backdrop-filter:blur(8px);`;
    overlay.innerHTML = `
      <div style="width:100%;max-width:380px;background:#fffbe8;border-radius:22px;border:2px solid #15181d;padding:22px 20px 19px;box-shadow:5px 5px 0 #15181d;color:#15181d;box-sizing:border-box;">
        <div style="text-align:center;margin-bottom:17px;">
          <div style="width:48px;height:48px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;border:2px solid #15181d;border-radius:13px;background:#65e7ae;box-shadow:3px 3px 0 #15181d;font-size:14px;font-weight:900;">BC</div>
          <h2 style="font-size:18px;font-weight:900;margin:0 0 5px;">Enter License Key</h2>
          <p style="font-size:10px;color:#66706b;font-weight:800;text-transform:uppercase;">BNDA · Secure activation</p>
        </div>
        <input id="__qx_key_input__" type="text" placeholder="BC-XXXX-XXXX-XXXX" autocomplete="off" style="width:100%;height:46px;padding:0 13px;border-radius:12px;border:1.5px solid #25292f;background:#fff;color:#15181d;font-size:13px;font-weight:800;box-sizing:border-box;outline:none;font-family:monospace;text-align:center;-webkit-appearance:none;"/>
        <div id="__qx_key_err__" style="font-size:11px;color:#9d3e34;min-height:18px;margin:7px 0 3px;text-align:center;font-weight:700;"></div>
        <button id="__qx_key_btn__" style="width:100%;min-height:44px;padding:12px;border-radius:12px;border:2px solid #15181d;background:#65e7ae;color:#10251c;font-size:12px;font-weight:900;cursor:pointer;box-shadow:3px 3px 0 #15181d;-webkit-appearance:none;">Activate Key</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px;">
          <a href="https://wa.me/923306363018?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;min-height:40px;padding:8px;border-radius:10px;background:#bff5d8;border:1.5px solid #15181d;color:#15181d;box-shadow:2px 2px 0 #15181d;text-decoration:none;text-align:center;font-size:9px;font-weight:900;">Buy on WhatsApp</a>
          <a href="https://t.me/bnda_Codex?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;min-height:40px;padding:8px;border-radius:10px;background:#cbe9ff;border:1.5px solid #15181d;color:#15181d;box-shadow:2px 2px 0 #15181d;text-decoration:none;text-align:center;font-size:9px;font-weight:900;">Buy on Telegram</a>
          <a href="https://whatsapp.com/channel/0029Vb5nZxj7j6g3Rt4YR32m" target="_blank" rel="noopener" style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:40px;padding:8px;border-radius:10px;background:#65e7ae;border:1.5px solid #15181d;color:#15181d;box-shadow:2px 2px 0 #15181d;text-decoration:none;text-align:center;font-size:10px;font-weight:900;">Join for Free License</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("__qx_key_btn__").addEventListener("click", async () => {
      const key = document.getElementById("__qx_key_input__").value.trim();
      const errEl = document.getElementById("__qx_key_err__");
      const btn = document.getElementById("__qx_key_btn__");
      // Local check
      const res = validateLicense(key);
      if (!res.valid) {
        if (res.expired) {
          overlay.remove();
          showBlockedPopup("expired");
          return;
        }
        errEl.textContent = "❌ Invalid key! Try again.";
        return;
      }
      // Remote check
      btn.textContent = "Checking...";
      btn.disabled = true;
      const remote = await validateKeyRemote(key);
      btn.textContent = "Activate Key";
      btn.disabled = false;
      if (!remote.valid) {
        overlay.remove();
        if (remote.reason === "device") showBlockedPopup("device");
        else if (remote.reason === "expired") showBlockedPopup("expired");
        else showBlockedPopup("revoked");
        return;
      }
      localStorage.setItem("qx_license", key);
      overlay.remove();
      showPopup();
    });
  }

  // --- License info popup ---
  function showLicenseInfo() {
    const key = localStorage.getItem("qx_license");
    if (!key) return;
    const res = validateLicense(key);
    if (!res.valid) return;

    const existing = document.getElementById("__qx_info__");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "__qx_info__";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999999;display:flex;align-items:flex-end;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;backdrop-filter:blur(8px);`;

    function getCountdown() {
      const diff = res.expireAt - Date.now();
      if (diff <= 0) return "Expired";
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `${d}d ${h}h ${m}m ${s}s`;
    }

    overlay.innerHTML = `
      <div style="width:100%;max-width:480px;background:linear-gradient(160deg,#071a0f,#0d2a18);border-radius:24px 24px 0 0;border:1px solid rgba(74,222,128,0.2);border-bottom:none;padding:28px 24px 36px;box-shadow:0 -20px 60px rgba(0,0,0,0.7);color:#fff;">
        <div style="width:40px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:0 auto 24px;"></div>
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:60px;height:60px;border-radius:50%;background:rgba(74,222,128,0.15);border:2px solid rgba(74,222,128,0.4);display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 12px;">✅</div>
          <h2 style="font-size:18px;font-weight:800;color:#4ade80;margin-bottom:4px;">License Active</h2>
          <p style="font-size:13px;color:rgba(255,255,255,0.5);">Welcome, <b style="color:#fff;">${res.name}</b></p>
        </div>
        <div style="background:rgba(0,0,0,0.3);border-radius:14px;padding:16px;margin-bottom:16px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="text-align:center;">
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Expires On</div>
              <div style="font-size:12px;color:#a855f7;font-weight:600;">${new Date(res.expireAt).toLocaleDateString()}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Time Left</div>
              <div id="__qx_countdown__" style="font-size:13px;font-weight:800;color:#4ade80;">${getCountdown()}</div>
            </div>
          </div>
        </div>
        <button id="__qx_info_ok__" style="width:100%;padding:15px;border-radius:14px;border:none;background:linear-gradient(90deg,#22c55e,#16a34a);color:#fff;font-size:15px;font-weight:700;cursor:pointer;-webkit-appearance:none;">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const timer = setInterval(() => {
      const el = document.getElementById("__qx_countdown__");
      if (!el) {
        clearInterval(timer);
        return;
      }
      el.textContent = getCountdown();
    }, 1000);

    document.getElementById("__qx_info_ok__").addEventListener("click", () => {
      clearInterval(timer);
      overlay.remove();
    });
  }

  // --- Check license on start ---
  async function checkLicense() {
  localStorage.setItem("_qx_valid", "1");
  localStorage.setItem("qx_license", "BYPASS");
  return true;
}

    

  const TG_LINK = `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;"><a href="https://wa.me/923306363018?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:10px 14px;color:#86efac;font-weight:700;text-decoration:none;font-size:12px;">Buy on WhatsApp</a><a href="https://t.me/bnda_Codex?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3);border-radius:10px;padding:10px 14px;color:#38bdf8;font-weight:700;text-decoration:none;font-size:12px;">Buy on Telegram</a><a href="https://whatsapp.com/channel/0029Vb5nZxj7j6g3Rt4YR32m" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.22);border-radius:10px;padding:10px 14px;color:#86efac;font-weight:700;text-decoration:none;font-size:12px;">Join for Free License</a></div>`;

  // --- Blocked popup ---
  function showBlockedPopup(type) {
    const existing = document.getElementById("__qx_blocked__");
    if (existing) existing.remove();
    const configs = {
      revoked: {
        icon: "🚫",
        iconBg: "rgba(239,68,68,0.15)",
        iconBorder: "rgba(239,68,68,0.3)",
        title: "License Key Revoked",
        titleColor: "#f87171",
        border: "rgba(239,68,68,0.2)",
        bg: "linear-gradient(160deg,#1a0505,#2d0f0f)",
        body: "Your license key has been removed by the admin.",
        cta: "To get a new key, contact us:",
      },
      expired: {
        icon: "⏰",
        iconBg: "rgba(250,204,21,0.15)",
        iconBorder: "rgba(250,204,21,0.3)",
        title: "Subscription Expired",
        titleColor: "#facc15",
        border: "rgba(250,204,21,0.2)",
        bg: "linear-gradient(160deg,#1a1500,#2d2200)",
        body: "Your subscription has ended. Renew to continue using BNDA.",
        cta: "Contact us to renew:",
      },
      device: {
        icon: "⛔",
        iconBg: "rgba(251,146,60,0.15)",
        iconBorder: "rgba(251,146,60,0.3)",
        title: "Already Used on Another Device",
        titleColor: "#fb923c",
        border: "rgba(251,146,60,0.2)",
        bg: "linear-gradient(160deg,#1a0a00,#2d1800)",
        body: "This key is already activated on a different device. One key works on one device only.",
        cta: "Contact to buy a new key:",
      },
    };
    const c = configs[type] || configs.revoked;
    const overlay = document.createElement("div");
    overlay.id = "__qx_blocked__";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999999;display:flex;align-items:flex-end;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;backdrop-filter:blur(10px);";
    overlay.innerHTML = `<div style="width:100%;max-width:480px;background:${c.bg};border-radius:24px 24px 0 0;border:1px solid ${c.border};border-bottom:none;padding:28px 24px 44px;box-shadow:0 -20px 60px rgba(0,0,0,0.8);color:#fff;"><div style="width:40px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 24px;"></div><div style="text-align:center;"><div style="width:72px;height:72px;border-radius:50%;background:${c.iconBg};border:2px solid ${c.iconBorder};display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px;">${c.icon}</div><h2 style="font-size:18px;font-weight:800;color:${c.titleColor};margin-bottom:10px;line-height:1.3;">${c.title}</h2><p style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.7;margin-bottom:6px;">${c.body}</p><p style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:14px;">${c.cta}</p><div style="display:flex;justify-content:center;">${TG_LINK}</div></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // --- Default CONFIG (popup se override hoga) ---
  let CONFIG = {
    lname: "BNDA",
    iblafp: "50000",
    customPosition: "+100",
    flagCode: "flag-pk",
    positionHeaderName: "",
    positionHeaderFlag: "flag-pk",
    customDemoBalance: "10000",
    baseBalance: 500,
    greenLinePct: 0,
    removeBanner: false,
    customDisplayBalance: null,
    customDemoDisplay: null,
    leaderboardAvatar: "",
    leaderboardCountry: "",
    lbStats: {
      count: "",
      profitable: "",
      profit: "",
      average: "",
      min: "",
      max: "",
    },
    brokerStats: {
      count: "",
      profitable: "",
      profit: "",
      average: "",
      turnover: "",
      hedged: "",
      min: "",
      max: "",
      maxProfit: "",
    },
  };
  try {
    CONFIG.leaderboardAvatar = localStorage.getItem("qx_leaderboard_avatar") || "";
    CONFIG.leaderboardCountry = localStorage.getItem("qx_leaderboard_country") || "";
  } catch (e) {}
  try {
    const savedStats = JSON.parse(localStorage.getItem("qx_leaderboard_stats") || "null");
    if (savedStats && typeof savedStats === "object") Object.assign(CONFIG.lbStats, savedStats);
  } catch (e) {}
  try {
    const savedBrokerStats = JSON.parse(localStorage.getItem("qx_broker_analytics") || "null");
    if (savedBrokerStats && typeof savedBrokerStats === "object") Object.assign(CONFIG.brokerStats, savedBrokerStats);
  } catch (e) {}
  let __qxLeaderboardAvatarVersion = 1;

  // --- URL MAP ---
  const URL_MAP = [
    { demo: "market-qx.trade/en/demo-trade", live: "https://market-qx.trade/en/trade" },
    { demo: "qxbroker.com/en/demo-trade", live: "https://qxbroker.com/en/trade" },
    { demo: "qxbroker.com/demo", live: "https://qxbroker.com/en/trade" },
  ];

  // ============================================================
  // POPUP UI
  // ============================================================

  function showTransactionPanelUi() {
    const old = document.getElementById("__qx_transaction_ui__");
    if (old) old.remove();
    const pop = document.createElement("div");
    pop.id = "__qx_transaction_ui__";
    pop.style.cssText =
      'position:fixed;inset:0;z-index:10000000;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(10,14,18,.7);backdrop-filter:blur(8px);font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    pop.innerHTML = `
      <div style="width:100%;max-width:380px;max-height:91vh;overflow-y:auto;background:#fffbe8;border:2px solid #15181d;border-radius:22px;box-shadow:5px 5px 0 #15181d;color:#15181d;box-sizing:border-box;">
        <div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:11px;padding:14px 15px;background:#fffbe8;border-bottom:2px solid #15181d;">
          <div style="width:39px;height:39px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;border:2px solid #15181d;border-radius:11px;background:#65e7ae;box-shadow:2px 2px 0 #15181d;font:900 11px 'Space Grotesk',sans-serif;">BC</div>
          <div style="min-width:0;flex:1;"><div style="font-size:8px;color:#66706b;text-transform:uppercase;font-weight:900;letter-spacing:1px;">BNDA · DEMO PREVIEW</div><div style="margin-top:2px;font:900 17px 'Space Grotesk',sans-serif;">Transaction Panel</div></div>
          <button id="__qx_transaction_close__" aria-label="Close" style="width:34px;height:34px;border:2px solid #15181d;border-radius:50%;background:#fff;color:#15181d;box-shadow:2px 2px 0 #15181d;font-weight:900;cursor:pointer;">&#10005;</button>
        </div>
        <div style="padding:13px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
            <div><label style="display:block;margin-bottom:5px;font-size:9px;color:#66706b;text-transform:uppercase;font-weight:900;">Type</label><select style="width:100%;height:41px;padding:0 10px;border:1.5px solid #25292f;border-radius:11px;background:#fff;color:#15181d;font-weight:800;"><option>Deposit</option><option>Payout</option></select></div>
            <div><label style="display:block;margin-bottom:5px;font-size:9px;color:#66706b;text-transform:uppercase;font-weight:900;">Amount</label><input type="number" inputmode="decimal" placeholder="18.00" style="width:100%;height:41px;padding:0 10px;border:1.5px solid #25292f;border-radius:11px;background:#fff;color:#15181d;font-weight:800;box-sizing:border-box;"/></div>
          </div>
          <div style="margin-top:9px;"><label style="display:block;margin-bottom:5px;font-size:9px;color:#66706b;text-transform:uppercase;font-weight:900;">Payment Method</label><select style="width:100%;height:41px;padding:0 10px;border:1.5px solid #25292f;border-radius:11px;background:#fff;color:#15181d;font-weight:800;"><option>Easypaisa</option><option>JazzCash</option><option>USDT (TRC-20)</option><option>USDT (BEP-20)</option><option>Binance Pay</option></select></div>
          <div style="margin-top:9px;"><label style="display:block;margin-bottom:5px;font-size:9px;color:#66706b;text-transform:uppercase;font-weight:900;">Preview Status</label><select style="width:100%;height:41px;padding:0 10px;border:1.5px solid #25292f;border-radius:11px;background:#f0f8f4;color:#15181d;font-weight:800;"><option>Success</option><option>Processing</option><option>Failed</option><option>Waiting confirmation</option></select></div>
          <div style="display:grid;grid-template-columns:1.25fr .75fr;gap:9px;margin-top:9px;">
            <div><label style="display:block;margin-bottom:5px;font-size:9px;color:#66706b;text-transform:uppercase;font-weight:900;">Date</label><input type="date" style="width:100%;height:41px;padding:0 9px;border:1.5px solid #25292f;border-radius:11px;background:#fff;color:#15181d;font-weight:700;box-sizing:border-box;"/></div>
            <div><label style="display:block;margin-bottom:5px;font-size:9px;color:#66706b;text-transform:uppercase;font-weight:900;">Time</label><input type="time" style="width:100%;height:41px;padding:0 8px;border:1.5px solid #25292f;border-radius:11px;background:#fff;color:#15181d;font-weight:700;box-sizing:border-box;"/></div>
          </div>
          <div style="margin-top:11px;padding:10px;border:1.5px solid #a9d6bf;border-radius:12px;background:#effaf4;color:#496158;font-size:10px;font-weight:800;line-height:1.45;">Preview-only controls — no transaction record is generated or changed.</div>
          <button id="__qx_transaction_done__" style="width:100%;min-height:43px;margin-top:10px;border:2px solid #15181d;border-radius:12px;background:#65e7ae;color:#10251c;box-shadow:3px 3px 0 #15181d;font:900 12px 'Space Grotesk',sans-serif;text-transform:uppercase;cursor:pointer;">Done</button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
            <a href="https://t.me/bnda_Codex?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noreferrer" style="padding:10px 7px;border:1.5px solid #15181d;border-radius:10px;background:#cbe9ff;color:#15181d;box-shadow:2px 2px 0 #15181d;text-align:center;text-decoration:none;font-size:9px;font-weight:900;">Buy on Telegram</a>
            <a href="https://wa.me/923306363018?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noreferrer" style="padding:10px 7px;border:1.5px solid #15181d;border-radius:10px;background:#bff5d8;color:#15181d;box-shadow:2px 2px 0 #15181d;text-align:center;text-decoration:none;font-size:9px;font-weight:900;">Buy on WhatsApp</a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(pop);
    const close = () => pop.remove();
    document.getElementById("__qx_transaction_close__").addEventListener("click", close);
    document.getElementById("__qx_transaction_done__").addEventListener("click", close);
    pop.addEventListener("click", (e) => {
      if (e.target === pop) close();
    });
  }

  function getLeaderboardCountry() {
    if (CONFIG.leaderboardCountry.trim()) return CONFIG.leaderboardCountry.trim();
    const region = CONFIG.flagCode.replace(/^flag-/, "").toUpperCase();
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(region) || region;
    } catch (e) {
      return region;
    }
  }

  function readAnalyticsNumber(value) {
    const number = parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(number) ? number : 0;
  }

  function formatBrokerMoney(value) {
    const number = readAnalyticsNumber(value);
    const decimals = Math.abs(number % 1) > 0.0001 ? 2 : 0;
    return `${number.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: 2 })} $`;
  }

  function brokerWinTheme(pct) {
    const p = Math.max(0, Math.min(100, pct));
    if (p < 50) return { stroke: "var(--color-red, #e05d54)", bg: "#fdecea", text: "#a33226", border: "#e05d54" };
    if (p < 75) return { stroke: "var(--color-orange, #eb9b3f)", bg: "#fff4e3", text: "#8a5a12", border: "#eb9b3f" };
    return { stroke: "var(--color-green, #1fbf75)", bg: "#e7fff3", text: "#0c7447", border: "#15965d" };
  }

  function setBrokerProgress(item, value) {
    const number = readAnalyticsNumber(value);
    const bars = Array.from(item.querySelectorAll(".HOsH5 .RsnIv > div"));
    if (!bars.length) return;
    const fill = number === 0 ? 0 : Math.min(100, Math.max(25, Math.abs(number)));
    const colorClass = number < 0 ? "red" : "green";
    bars.forEach((bar, index) => {
      const segmentFill = Math.max(0, Math.min(100, (fill - index * 25) * 4));
      if (bar.className !== colorClass) bar.className = colorClass;
      const width = `${segmentFill}%`;
      if (bar.style.width !== width) bar.style.width = width;
    });
  }

  function fixBrokerAnalytics() {
    const stats = CONFIG.brokerStats;
    const count = Math.max(0, Math.round(readAnalyticsNumber(stats.count)));
    const profitable = Math.max(0, Math.min(count, Math.round(readAnalyticsNumber(stats.profitable))));
    const winPct = count > 0 ? Math.min(100, Math.max(0, (profitable / count) * 100)) : 0;
    document.querySelectorAll(".analytics__profile-statistics").forEach((root) => {
      root.querySelectorAll(".analytics__profile-statistics__item").forEach((item) => {
        const label = (item.querySelector(".analytics__profile-statistics__item-label")?.textContent || "")
          .trim()
          .toLowerCase();
        if (label === "trades count" && stats.count !== "") {
          const cont = item.querySelector(".analytics__profile-statistics__item-cont");
          if (cont) cont.dataset.pct = String(count);
          const bar = item.querySelector("#trades-bar");
          if (bar) {
            bar.style.strokeDashoffset = "0";
            bar.style.stroke = "var(--color-green)";
          }
          return;
        }
        if (label === "profitable trades" && (stats.count !== "" || stats.profitable !== "")) {
          const cont = item.querySelector(".analytics__profile-statistics__item-win-cont");
          if (cont) {
            cont.dataset.pct = String(profitable);
            cont.dataset.value = String(Math.round(winPct));
          }
          const bar = item.querySelector("#win-trades-bar");
          if (bar) {
            bar.style.strokeDashoffset = String(150.79 * (1 - winPct / 100));
            const winColor = brokerWinTheme(winPct).stroke;
            if (bar.style.stroke !== winColor) bar.style.stroke = winColor;
          }
          return;
        }
        const keyByLabel = {
          "trades profit": "profit",
          "average profit": "average",
          "net turnover": "turnover",
          "hedged trades": "hedged",
          "min trade amount": "min",
          "max trade amount": "max",
          "max trade profit": "maxProfit",
        };
        const key = keyByLabel[label];
        if (!key || stats[key] === "") return;
        const money = item.querySelector(".analytics__profile-statistics__item-money");
        const next = formatBrokerMoney(stats[key]);
        if (money && money.textContent !== next) money.textContent = next;
        setBrokerProgress(item, stats[key]);
      });
    });
  }

  function showLeaderboardAnalyticsPanel() {
    document.getElementById("__qx_lb_panel__")?.remove();
    const pop = document.createElement("div");
    pop.id = "__qx_lb_panel__";
    pop.style.cssText =
      'position:fixed;inset:0;z-index:1000001;display:flex;align-items:flex-end;justify-content:center;padding:10px;background:rgba(10,14,18,.7);backdrop-filter:blur(8px);font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    pop.innerHTML = `
      <div style="width:100%;max-width:390px;max-height:88vh;overflow-y:auto;background:#fffbe8;border:2px solid #15181d;border-radius:20px;box-shadow:5px 5px 0 #15181d;color:#15181d;box-sizing:border-box;">
        <div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:12px 13px;background:#fffbe8;border-bottom:2px solid #15181d;">
          <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:2px solid #15181d;border-radius:10px;background:#65e7ae;box-shadow:2px 2px 0 #15181d;font:900 10px 'Space Grotesk',sans-serif;">BC</div>
          <div style="min-width:0;flex:1;"><div style="font-size:8px;color:#66706b;text-transform:uppercase;font-weight:900;">BNDA · PROFILE</div><div style="font:900 15px 'Space Grotesk',sans-serif;margin-top:2px;">Leaderboard Analytics</div></div>
          <button id="__qx_lb_close__" aria-label="Close" style="width:34px;height:34px;border:2px solid #15181d;border-radius:50%;background:#fff;color:#15181d;box-shadow:2px 2px 0 #15181d;font-weight:900;cursor:pointer;">&#10005;</button>
        </div>
        <div style="padding:12px;">
          <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid #15181d;border-radius:13px;background:#fff;box-shadow:2px 2px 0 rgba(21,24,29,.12);">
            <div id="__qx_lb_avatar_preview__" style="width:46px;height:46px;flex:0 0 46px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #15181d;border-radius:13px;background:#effaf4;color:#66706b;font:900 9px 'Space Grotesk',sans-serif;">LOGO</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:7px;flex:1;min-width:0;">
              <button id="__qx_lb_avatar_pick__" style="min-height:39px;padding:8px;border:1.5px solid #15181d;border-radius:10px;background:#bff5d8;color:#15181d;box-shadow:2px 2px 0 #15181d;font-weight:900;cursor:pointer;">Upload Logo</button>
              <button id="__qx_lb_avatar_remove__" aria-label="Remove logo" style="width:39px;min-height:39px;border:1.5px solid #15181d;border-radius:10px;background:#fff;color:#15181d;box-shadow:2px 2px 0 #15181d;font-weight:900;cursor:pointer;">&#10005;</button>
            </div>
          </div>
          <input id="__qx_lb_avatar_input__" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none!important;"/>
          <label style="display:block;margin:11px 0 5px;color:#66706b;font-size:9px;font-weight:900;text-transform:uppercase;">Country name</label>
          <input id="__qx_lb_country__" type="text" autocomplete="off" placeholder="Auto: ${getLeaderboardCountry()}" style="width:100%;height:40px;padding:0 10px;border:1.5px solid #25292f;border-radius:11px;background:#fff;color:#15181d;font-weight:800;box-sizing:border-box;outline:none;"/>
          <div style="margin-top:5px;color:#7e8782;font-size:9px;font-weight:700;line-height:1.4;">Leave blank to use the selected Market Region automatically.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px;">
            ${[
              ["count", "Trades count", "534"],
              ["profitable", "Profitable trades", "276"],
              ["profit", "Trades profit", "13492.74"],
              ["average", "Average profit", "25.27"],
              ["min", "Min trade amount", "60"],
              ["max", "Max trade amount", "783.36"],
            ]
              .map(
                ([key, label, example]) =>
                  `<div><label style="display:block;margin:0 0 4px;color:#66706b;font-size:8px;font-weight:900;text-transform:uppercase;">${label}</label><input id="__qx_lb_${key}__" type="text" inputmode="decimal" placeholder="e.g. ${example}" style="width:100%;height:39px;padding:0 9px;border:1.5px solid #25292f;border-radius:10px;background:#fff;color:#15181d;font-weight:800;box-sizing:border-box;outline:none;"/></div>`,
              )
              .join("")}
          </div>
          <button id="__qx_lb_done__" style="width:100%;min-height:41px;margin-top:13px;border:2px solid #15181d;border-radius:11px;background:#65e7ae;color:#10251c;box-shadow:3px 3px 0 #15181d;font:900 11px 'Space Grotesk',sans-serif;text-transform:uppercase;cursor:pointer;">Done</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    const preview = document.getElementById("__qx_lb_avatar_preview__");
    const renderPreview = () => {
      preview.replaceChildren();
      if (!CONFIG.leaderboardAvatar) {
        preview.textContent = "LOGO";
        return;
      }
      const img = document.createElement("img");
      img.src = CONFIG.leaderboardAvatar;
      img.alt = "Leaderboard logo preview";
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      preview.appendChild(img);
    };
    renderPreview();
    const country = document.getElementById("__qx_lb_country__");
    country.value = CONFIG.leaderboardCountry;
    country.addEventListener("input", () => {
      CONFIG.leaderboardCountry = country.value;
      try {
        if (CONFIG.leaderboardCountry.trim()) localStorage.setItem("qx_leaderboard_country", CONFIG.leaderboardCountry);
        else localStorage.removeItem("qx_leaderboard_country");
      } catch (e) {}
      fixLeaderboardTooltip();
    });
    ["count", "profitable", "profit", "average", "min", "max"].forEach((key) => {
      const input = document.getElementById(`__qx_lb_${key}__`);
      input.value = CONFIG.lbStats[key] || "";
      input.addEventListener("input", () => {
        CONFIG.lbStats[key] = input.value.trim();
        try {
          localStorage.setItem("qx_leaderboard_stats", JSON.stringify(CONFIG.lbStats));
        } catch (e) {}
        fixLeaderboardTooltip();
      });
    });
    const fileInput = document.getElementById("__qx_lb_avatar_input__");
    document.getElementById("__qx_lb_avatar_pick__").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const source = new Image();
        source.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 192;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const crop = Math.min(source.naturalWidth, source.naturalHeight);
          ctx.drawImage(source, (source.naturalWidth - crop) / 2, (source.naturalHeight - crop) / 2, crop, crop, 0, 0, 192, 192);
          CONFIG.leaderboardAvatar = canvas.toDataURL("image/webp", 0.86);
          __qxLeaderboardAvatarVersion += 1;
          try {
            localStorage.setItem("qx_leaderboard_avatar", CONFIG.leaderboardAvatar);
          } catch (e) {}
          renderPreview();
          fixLeaderboard();
          fixLeaderboardTooltip();
        };
        source.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
      fileInput.value = "";
    });
    document.getElementById("__qx_lb_avatar_remove__").addEventListener("click", () => {
      CONFIG.leaderboardAvatar = "";
      __qxLeaderboardAvatarVersion += 1;
      try {
        localStorage.removeItem("qx_leaderboard_avatar");
      } catch (e) {}
      renderPreview();
      fixLeaderboard();
      fixLeaderboardTooltip();
    });
    const close = () => pop.remove();
    const done = () => {
      // Done dabate hi sab jagah foran apply — position ka intezaar nahi:
      // sidebar .JPftH summary name, ranked row, hover card sab refresh.
      try { fixLeaderboard(); } catch (e) {}
      try { fixLeaderboardTooltip(); } catch (e) {}
      close();
    };
    document.getElementById("__qx_lb_close__").addEventListener("click", close);
    document.getElementById("__qx_lb_done__").addEventListener("click", done);
    pop.addEventListener("click", (e) => {
      if (e.target === pop) close();
    });
  }

  function showBrokerAnalyticsPanel() {
    document.getElementById("__qx_ba_panel__")?.remove();
    const pop = document.createElement("div");
    pop.id = "__qx_ba_panel__";
    pop.style.cssText =
      'position:fixed;inset:0;z-index:1000001;display:flex;align-items:flex-end;justify-content:center;padding:10px;background:rgba(10,14,18,.7);backdrop-filter:blur(8px);font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    pop.innerHTML = `
      <div style="width:100%;max-width:390px;max-height:88vh;overflow-y:auto;background:#fffbe8;border:2px solid #15181d;border-radius:20px;box-shadow:5px 5px 0 #15181d;color:#15181d;box-sizing:border-box;">
        <div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:12px 13px;background:#fffbe8;border-bottom:2px solid #15181d;">
          <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:2px solid #15181d;border-radius:10px;background:#65e7ae;box-shadow:2px 2px 0 #15181d;font:900 10px 'Space Grotesk',sans-serif;">BC</div>
          <div style="min-width:0;flex:1;"><div style="font-size:8px;color:#66706b;text-transform:uppercase;font-weight:900;">BNDA · BROKER</div><div style="font:900 15px 'Space Grotesk',sans-serif;margin-top:2px;">Broker Analytics</div></div>
          <button id="__qx_ba_close__" aria-label="Close" style="width:34px;height:34px;border:2px solid #15181d;border-radius:50%;background:#fff;color:#15181d;box-shadow:2px 2px 0 #15181d;font-weight:900;cursor:pointer;">&#10005;</button>
        </div>
        <div style="padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1.5px solid #15181d;border-radius:12px;background:#fff;box-shadow:2px 2px 0 rgba(21,24,29,.12);">
            <strong style="font:900 12px 'Space Grotesk',sans-serif;">Profitable trades</strong>
            <span id="__qx_broker_pct__" style="padding:4px 7px;border:1px solid #15965d;border-radius:8px;background:#e7fff3;color:#0c7447;font-size:9px;font-weight:900;transition:background .15s,color .15s,border-color .15s;">0% profitable</span>
          </div>
          <div style="margin-top:5px;color:#7e8782;font-size:9px;font-weight:700;line-height:1.4;">Percentage ke hisaab se color: neeche red, beech orange, upar green.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
            ${[
              ["count", "Trades count", "364"],
              ["profitable", "Profitable trades", "189"],
              ["profit", "Trades profit", "12800"],
              ["average", "Average profit", "35.16"],
              ["turnover", "Net turnover", "18450"],
              ["hedged", "Hedged trades", "8"],
              ["min", "Min trade amount", "1"],
              ["max", "Max trade amount", "850"],
              ["maxProfit", "Max trade profit", "782.50"],
            ]
              .map(
                ([key, label, example]) =>
                  `<div><label style="display:block;margin:0 0 4px;color:#66706b;font-size:8px;font-weight:900;text-transform:uppercase;">${label}</label><input id="__qx_broker_${key}__" type="text" inputmode="decimal" placeholder="e.g. ${example}" style="width:100%;height:39px;padding:0 9px;border:1.5px solid #25292f;border-radius:10px;background:#fff;color:#15181d;font-weight:800;box-sizing:border-box;outline:none;"/></div>`,
              )
              .join("")}
          </div>
          <button id="__qx_ba_done__" style="width:100%;min-height:41px;margin-top:12px;border:2px solid #15181d;border-radius:11px;background:#65e7ae;color:#10251c;box-shadow:3px 3px 0 #15181d;font:900 11px 'Space Grotesk',sans-serif;text-transform:uppercase;cursor:pointer;">Done</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    const updateBrokerPercentage = () => {
      const count = Math.max(0, readAnalyticsNumber(CONFIG.brokerStats.count));
      const profitable = Math.max(0, Math.min(count, readAnalyticsNumber(CONFIG.brokerStats.profitable)));
      const percentage = count > 0 ? Math.round((profitable / count) * 100) : 0;
      const badge = document.getElementById("__qx_broker_pct__");
      if (badge) {
        const theme = brokerWinTheme(percentage);
        badge.textContent = `${percentage}% profitable`;
        if (badge.style.borderColor !== theme.border) badge.style.borderColor = theme.border;
        if (badge.style.background !== theme.bg) badge.style.background = theme.bg;
        if (badge.style.color !== theme.text) badge.style.color = theme.text;
      }
    };
    ["count", "profitable", "profit", "average", "turnover", "hedged", "min", "max", "maxProfit"].forEach(
      (key) => {
        const input = document.getElementById(`__qx_broker_${key}__`);
        input.value = CONFIG.brokerStats[key] || "";
        input.addEventListener("input", () => {
          CONFIG.brokerStats[key] = input.value.trim();
          try {
            localStorage.setItem("qx_broker_analytics", JSON.stringify(CONFIG.brokerStats));
          } catch (e) {}
          updateBrokerPercentage();
          fixBrokerAnalytics();
        });
      },
    );
    updateBrokerPercentage();
    fixBrokerAnalytics();
    const close = () => pop.remove();
    document.getElementById("__qx_ba_close__").addEventListener("click", close);
    document.getElementById("__qx_ba_done__").addEventListener("click", close);
    pop.addEventListener("click", (e) => {
      if (e.target === pop) close();
    });
  }

  function showPopup() {
    const existing = document.getElementById("__qx_popup__");
    if (existing) existing.remove();
    if (!document.getElementById("__qx_ui_css__")) {
      const st = document.createElement("style");
      st.id = "__qx_ui_css__";
      st.textContent = `
        @keyframes __qxUp{from{transform:translateY(100%);opacity:.55}to{transform:translateY(0);opacity:1}}
        @keyframes __qxPulse{0%,100%{opacity:1}50%{opacity:.45}}
        #__qx_popup__ *{box-sizing:border-box;letter-spacing:0;font-family:"DM Sans",ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        #__qx_popup__ .__qx_sheet{position:relative;width:calc(100% - 20px)!important;max-width:410px!important;margin:10px!important;border-radius:24px!important;border:2px solid #15181d!important;background:#fffbe8!important;box-shadow:0 22px 70px rgba(0,0,0,.42),0 5px 0 #15181d!important;overflow:hidden!important;}
        #__qx_popup__ .__qx_scroll{max-height:min(91vh,760px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#b9c2ba transparent;}
        #__qx_popup__ .__qx_header{position:sticky;top:0;z-index:4;padding:18px 18px 15px;background:rgba(255,251,232,.96);border-bottom:2px solid #15181d;backdrop-filter:blur(12px);}
        #__qx_popup__ .__qx_brand{width:42px;height:42px;border:2px solid #15181d;border-radius:13px;background:#65e7ae;color:#15181d;display:flex;align-items:center;justify-content:center;font:800 12px "Space Grotesk",sans-serif;box-shadow:3px 3px 0 #15181d;}
        #__qx_popup__ .__qx_kicker{font-size:9px;color:#66706b;text-transform:uppercase;font-weight:800;letter-spacing:1.2px;}
        #__qx_popup__ .__qx_title{font:800 18px/1.1 "Space Grotesk",sans-serif;color:#15181d;margin:3px 0 0;}
        #__qx_popup__ .__qx_status{display:flex;align-items:center;gap:5px;border:1.5px solid #15181d;border-radius:999px;background:#bff5d8;padding:5px 8px;color:#174c36;font-size:9px;font-weight:800;text-transform:uppercase;}
        #__qx_popup__ .__qx_status i{display:block;width:6px;height:6px;border-radius:50%;background:#15965d;animation:__qxPulse 1.8s ease-in-out infinite;}
        #__qx_popup__ .__qx_body{padding:16px 17px 19px;}
        #__qx_popup__ .__qx_section{margin:0 0 14px;padding:14px;border:1.5px solid #15181d;background:#fff;border-radius:16px;box-shadow:3px 3px 0 rgba(21,24,29,.12);}
        #__qx_popup__ .__qx_section_head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
        #__qx_popup__ .__qx_section_head span:first-child{font:800 11px "Space Grotesk",sans-serif;color:#15181d;text-transform:uppercase;letter-spacing:.8px;}
        #__qx_popup__ .__qx_section_head span:last-child{font:700 9px "Space Grotesk",sans-serif;color:#8a928e;}
        #__qx_popup__ label{font-size:10px!important;color:#66706b!important;display:block!important;margin:0 0 6px!important;text-transform:uppercase!important;font-weight:800!important;letter-spacing:.65px!important;}
        #__qx_popup__ input,#__qx_popup__ select{height:48px!important;padding:0 13px!important;border-radius:12px!important;border:1.5px solid #25292f!important;background:#f7f8f5!important;color:#15181d!important;font-size:14px!important;font-weight:700!important;transition:border-color .14s,box-shadow .14s,background .14s;}
        #__qx_popup__ input:focus,#__qx_popup__ select:focus{border-color:#15965d!important;box-shadow:0 0 0 3px rgba(101,231,174,.3)!important;background:#fff!important;}
        #__qx_popup__ button{min-height:46px;border-radius:12px!important;transition:transform .1s ease,box-shadow .1s ease,filter .14s ease!important;letter-spacing:0;}
        #__qx_popup__ button:active{transform:translate(2px,2px)!important;box-shadow:none!important;}
        #__qx_popup__ #__qx_close__{width:36px!important;height:36px!important;min-height:36px!important;border:2px solid #15181d!important;border-radius:50%!important;background:#fff!important;color:#15181d!important;font-size:15px!important;box-shadow:2px 2px 0 #15181d!important;}
        #__qx_popup__ #__qx_apply__{background:#65e7ae!important;color:#10251c!important;border:2px solid #15181d!important;box-shadow:4px 4px 0 #15181d!important;text-transform:uppercase;font:800 12px "Space Grotesk",sans-serif!important;}
        #__qx_popup__ #__qx_fullscreen__{margin-bottom:10px;background:#15181d!important;color:#fffbe8!important;border:2px solid #15181d!important;box-shadow:4px 4px 0 #65e7ae!important;text-transform:uppercase;font:800 12px "Space Grotesk",sans-serif!important;}
        #__qx_popup__ #__qx_rm_banner__,#__qx_popup__ #__qx_edit_bal__{background:#fff!important;border:1.5px solid #15181d!important;color:#25292f!important;font-size:11px!important;font-weight:800!important;box-shadow:2px 2px 0 #15181d!important;}
        #__qx_popup__ #__qx_preview__{background:#f0f8f4!important;border:1.5px solid #b7d7c8!important;border-radius:10px!important;color:#49554f!important;text-align:left!important;font:700 11px "DM Sans",sans-serif!important;line-height:1.55!important;}
        #__qx_popup__ #__qx_gl_slider__{height:auto!important;padding:0!important;accent-color:#15965d!important;background:transparent!important;}
        #__qx_popup__ .__qx_range_box{margin-top:11px;padding:13px;background:#effaf4;border:1.5px solid #a9d6bf;border-radius:13px;}
        #__qx_popup__ #__qx_lb_open__,#__qx_popup__ #__qx_ba_open__{width:100%;min-height:42px!important;padding:10px 12px!important;border:1.5px solid #15181d!important;border-radius:12px!important;background:#bff5d8!important;color:#15181d!important;box-shadow:2px 2px 0 #15181d!important;font:900 10px "Space Grotesk",sans-serif!important;text-transform:uppercase;cursor:pointer;}
        #__qx_popup__ .__qx_contacts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px;}
        #__qx_popup__ .__qx_contact{display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:9px 8px;border:1.5px solid #15181d;border-radius:11px;color:#15181d;text-decoration:none;font:800 10px "Space Grotesk",sans-serif;box-shadow:2px 2px 0 #15181d;}
        #__qx_popup__ .__qx_contact_tg{background:#cbe9ff;}
        #__qx_popup__ .__qx_contact_wa{background:#bff5d8;}
        #__qx_popup__ .__qx_footer{display:flex;justify-content:space-between;align-items:center;margin-top:15px;padding-top:12px;border-top:1px solid #d9ddd8;font:800 9px "Space Grotesk",sans-serif;color:#7e8782;text-transform:uppercase;}
        #__qx_popup__ .__qx_scroll::-webkit-scrollbar{width:5px}
        #__qx_popup__ .__qx_scroll::-webkit-scrollbar-thumb{background:#b9c2ba;border-radius:10px}
        @media(max-width:420px){#__qx_popup__{align-items:flex-end!important}#__qx_popup__ .__qx_sheet{width:100%!important;max-width:none!important;margin:0!important;border-radius:20px 20px 0 0!important;border-width:2px 0 0!important;box-shadow:0 -14px 44px rgba(0,0,0,.3)!important}#__qx_popup__ .__qx_scroll{max-height:88vh}#__qx_popup__ .__qx_header{padding:11px 13px 10px!important}#__qx_popup__ .__qx_brand{width:35px;height:35px;border-radius:10px;box-shadow:2px 2px 0 #15181d}#__qx_popup__ .__qx_title{font-size:15px}#__qx_popup__ .__qx_status{padding:4px 6px;font-size:8px}#__qx_popup__ .__qx_body{padding:10px 12px 14px!important}#__qx_popup__ .__qx_section{margin-bottom:9px;padding:10px;border-radius:13px}#__qx_popup__ .__qx_section_head{margin-bottom:8px}#__qx_popup__ label{margin-bottom:4px!important;font-size:9px!important}#__qx_popup__ input,#__qx_popup__ select{height:40px!important;padding:0 10px!important;font-size:12px!important}#__qx_popup__ button{min-height:39px!important}#__qx_popup__ #__qx_fullscreen__{margin-bottom:7px;padding:10px!important}#__qx_popup__ #__qx_apply__{padding:10px!important}#__qx_popup__ .__qx_range_box{margin-top:8px;padding:9px}#__qx_popup__ .__qx_contacts{margin-top:8px}#__qx_popup__ .__qx_footer{margin-top:10px;padding-top:9px}}
        @media(prefers-reduced-motion:reduce){#__qx_popup__ .__qx_sheet{animation:none!important}#__qx_popup__ .__qx_status i{animation:none!important}}
      `;
      document.head.appendChild(st);
    }
    const overlay = document.createElement("div");
    overlay.id = "__qx_popup__";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(10,14,18,.68);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);";
    const sheet = document.createElement("div");
    sheet.className = "__qx_sheet";
    sheet.style.cssText = "color:#15181d;animation:__qxUp .28s cubic-bezier(.16,1,.3,1);";
    sheet.innerHTML = `
      <div class="__qx_scroll">
      <div class="__qx_header">
        <div style="display:flex;align-items:center;gap:11px;">
          <div class="__qx_brand">BC</div>
          <div style="flex:1;min-width:0;">
            <div class="__qx_kicker">BNDA · CONTROL MENU</div>
            <h2 class="__qx_title">Quick Settings</h2>
          </div>
          <div class="__qx_status"><i></i> Active</div>
          <button id="__qx_close__" aria-label="Close" style="cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;">&#10005;</button>
        </div>
      </div>
      <div class="__qx_body">
        <div class="__qx_section">
        <div class="__qx_section_head"><span>Your profile</span><span>01</span></div>
        <label>Display name</label>
        <input id="__qx_name__" type="text" placeholder="e.g. BNDA" autocomplete="off" style="width:100%;margin-bottom:11px;outline:none;-webkit-appearance:none;"/>
        <label>Market region</label>
        <select id="__qx_flag__" style="width:100%;outline:none;cursor:pointer;-webkit-appearance:none;">

          <option value="flag-pk">&#127477;&#127472; Pakistan</option>
          <option value="flag-in">&#127470;&#127475; India</option>
          <option value="flag-bd">&#127463;&#127465; Bangladesh</option>
          <option value="flag-lk">&#127473;&#127472; Sri Lanka</option>
          <option value="flag-ae">&#127462;&#127466; UAE</option>
          <option value="flag-sa">&#127480;&#127462; Saudi Arabia</option>
          <option value="flag-us">&#127482;&#127480; USA</option>
          <option value="flag-gb">&#127468;&#127463; UK</option>
          <option value="flag-ng">&#127475;&#127468; Nigeria</option>
          <option value="flag-br">&#127463;&#127479; Brazil</option>
          <option value="flag-id">&#127470;&#127465; Indonesia</option>
          <option value="flag-ph">&#127477;&#127469; Philippines</option>
          <option value="flag-eg">&#127466;&#127468; Egypt</option>
          <option value="flag-tr">&#127481;&#127479; Turkey</option>
          <option value="flag-mx">&#127474;&#127485; Mexico</option>
          <option value="flag-ke">&#127472;&#127466; Kenya</option>
          <option value="flag-np">&#127475;&#127477; Nepal</option>
          <option value="flag-mm">&#127474;&#127474; Myanmar</option>
          <option value="flag-th">&#127481;&#127469; Thailand</option>
          <option value="flag-vn">&#127483;&#127475; Vietnam</option>
          <option value="flag-my">&#127474;&#127486; Malaysia</option>
          <option value="flag-gh">&#127468;&#127469; Ghana</option>
          <option value="flag-tz">&#127481;&#127487; Tanzania</option>
          <option value="flag-ug">&#127482;&#127468; Uganda</option>
          <option value="flag-et">&#127466;&#127481; Ethiopia</option>
          <option value="flag-za">&#127487;&#127462; South Africa</option>
          <option value="flag-iq">&#127470;&#127478; Iraq</option>
          <option value="flag-ir">&#127470;&#127479; Iran</option>
          <option value="flag-kw">&#127472;&#127484; Kuwait</option>
          <option value="flag-qa">&#127478;&#127462; Qatar</option>
          <option value="flag-om">&#127476;&#127474; Oman</option>
          <option value="flag-jo">&#127471;&#127476; Jordan</option>
          <option value="flag-ma">&#127474;&#127462; Morocco</option>
          <option value="flag-dz">&#127465;&#127487; Algeria</option>
          <option value="flag-tn">&#127481;&#127475; Tunisia</option>
          <option value="flag-ly">&#127473;&#127486; Libya</option>
          <option value="flag-sd">&#127480;&#127465; Sudan</option>
          <option value="flag-co">&#127464;&#127476; Colombia</option>
          <option value="flag-ar">&#127462;&#127479; Argentina</option>
          <option value="flag-pe">&#127477;&#127466; Peru</option>
          <option value="flag-ve">&#127483;&#127466; Venezuela</option>
          <option value="flag-cl">&#127464;&#127473; Chile</option>
          <option value="flag-ru">&#127479;&#127482; Russia</option>
          <option value="flag-ua">&#127482;&#127462; Ukraine</option>
          <option value="flag-kz">&#127472;&#127487; Kazakhstan</option>
          <option value="flag-uz">&#127482;&#127487; Uzbekistan</option>
          <option value="flag-de">&#127465;&#127466; Germany</option>
          <option value="flag-fr">&#127467;&#127479; France</option>
          <option value="flag-it">&#127470;&#127481; Italy</option>
          <option value="flag-es">&#127466;&#127480; Spain</option>
          <option value="flag-pt">&#127477;&#127481; Portugal</option>
          <option value="flag-cn">&#127464;&#127475; China</option>
          <option value="flag-jp">&#127471;&#127477; Japan</option>
          <option value="flag-kr">&#127472;&#127479; South Korea</option>
          <option value="flag-ca">&#127464;&#127462; Canada</option>
          <option value="flag-au">&#127462;&#127482; Australia</option>
        </select></div>
        <div class="__qx_section">
        <div class="__qx_section_head"><span>Balance settings</span><span>03</span></div>
        <label>Base Balance · P&amp;L threshold</label>
        <input id="__qx_base__" type="number" placeholder="e.g. 500" inputmode="numeric" style="width:100%;margin-bottom:10px;outline:none;-webkit-appearance:none;"/>
        <div id="__qx_preview__" style="font-size:12px;margin-bottom:0;padding:10px 12px;">Preview: calculating...</div>
        </div>
        <button id="__qx_fullscreen__" style="width:100%;padding:14px;cursor:pointer;-webkit-appearance:none;">&#9974; Fullscreen</button>
        <button id="__qx_apply__" style="width:100%;padding:14px;cursor:pointer;-webkit-appearance:none;">&#10003; Done</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <button id="__qx_rm_banner__" style="padding:12px;cursor:pointer;-webkit-appearance:none;">Remove Banner</button>
          <button id="__qx_edit_bal__" style="padding:12px;cursor:pointer;-webkit-appearance:none;">Edit Balance</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <button id="__qx_lb_open__" type="button">Leaderboard Analytics &#8594;</button>
          <button id="__qx_ba_open__" type="button">Broker Analytics &#8594;</button>
        </div>
        <div class="__qx_range_box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:10px;color:#66706b;text-transform:uppercase;font-weight:800;">Green Line Value</span>
            <span id="__qx_gl_val__" style="font-size:13px;font-weight:800;color:#15965d;">$0</span>
          </div>
          <input id="__qx_gl_slider__" type="range" min="0" max="100" step="1" value="0" style="width:100%;accent-color:#4ade80;cursor:pointer;"/>
        </div>
        <div class="__qx_contacts">
          <a class="__qx_contact __qx_contact_tg" href="https://t.me/bnda_Codex?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noreferrer">Buy on Telegram</a>
          <a class="__qx_contact __qx_contact_wa" href="https://wa.me/923306363018?text=Assalam-o-Alaikum%20Sir%2C%20I%20want%20to%20buy%20the%20BC%20CODER%20bookmark.%20Please%20share%20the%20price%20and%20license%20details." target="_blank" rel="noreferrer">Buy on WhatsApp</a>
        </div>
        <div class="__qx_footer"><span>BNDA</span><span>Settings apply instantly</span></div>
      </div></div>`;
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    document.getElementById("__qx_name__").value = CONFIG.lname;
    document.getElementById("__qx_base__").value = CONFIG.baseBalance;
    document.getElementById("__qx_flag__").value = CONFIG.flagCode;
    function updatePreview() {
      const base = parseFloat(document.getElementById("__qx_base__").value) || 0;
      const bal = getLiveBalance();
      const curr = bal ? bal.num : 0;
      const diff = curr - base;
      const sign = diff >= 0 ? "+" : "";
      const color = diff >= 0 ? "#4ade80" : "#f87171";
      document.getElementById("__qx_preview__").innerHTML =
        `Balance: <b>$${curr.toFixed(2)}</b> | Base: <b>$${base}</b> | PNL: <span style="color:${color};font-weight:700;">${sign}$${Math.abs(diff).toFixed(2)}</span>`;
    }
    updatePreview();
    const applyPanelSettings = () => {
      CONFIG.lname = document.getElementById("__qx_name__").value.trim() || CONFIG.lname;
      CONFIG.flagCode = document.getElementById("__qx_flag__").value;
      CONFIG.positionHeaderFlag = CONFIG.flagCode;
      CONFIG.baseBalance = parseFloat(document.getElementById("__qx_base__").value) || 0;
      runAll();
    };
    document.getElementById("__qx_name__").addEventListener("input", applyPanelSettings);
    document.getElementById("__qx_flag__").addEventListener("change", applyPanelSettings);
    document.getElementById("__qx_lb_open__").addEventListener("click", showLeaderboardAnalyticsPanel);
    document.getElementById("__qx_ba_open__").addEventListener("click", showBrokerAnalyticsPanel);
    document.getElementById("__qx_base__").addEventListener("input", () => {
      updatePreview();
      applyPanelSettings();
    });
    document.getElementById("__qx_fullscreen__").addEventListener("click", () => {
      goFullscreenNow();
      document.getElementById("__qx_fullscreen__").textContent = "\u2713 Fullscreen Active";
    });
    const slider = document.getElementById("__qx_gl_slider__");
    const glVal = document.getElementById("__qx_gl_val__");
    slider.value = 0;
    glVal.textContent = "0%";
    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      glVal.textContent = v + "%";
      CONFIG.greenLinePct = v;
      _updateGreenLine(v);
    });
    document.getElementById("__qx_edit_bal__").addEventListener("click", () => {
      const existing = document.getElementById("__qx_bal_popup__");
      if (existing) existing.remove();
      const pop = document.createElement("div");
      pop.id = "__qx_bal_popup__";
      pop.style.cssText =
        'position:fixed;inset:0;background:rgba(10,14,18,.68);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:14px;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;backdrop-filter:blur(8px);';
      pop.innerHTML = `
        <div style="width:100%;max-width:370px;background:#fffbe8;border-radius:22px;border:2px solid #15181d;padding:23px 20px 20px;box-shadow:5px 5px 0 #15181d;color:#15181d;box-sizing:border-box;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <div style="width:44px;height:44px;border:2px solid #15181d;border-radius:13px;background:#65e7ae;display:flex;align-items:center;justify-content:center;font-size:21px;box-shadow:2px 2px 0 #15181d;">💰</div>
            <div><div style="font-size:9px;color:#66706b;text-transform:uppercase;font-weight:800;letter-spacing:1px;">BNDA · BALANCE</div>
            <h2 style="font-size:17px;font-weight:900;color:#15181d;margin:3px 0 0;">Edit Demo Balance</h2></div>
          </div>
          <label style="display:block;margin-bottom:6px;color:#66706b;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.65px;">Display amount</label>
          <input id="__qx_bal_input__" type="number" placeholder="e.g. 10000" inputmode="numeric" style="width:100%;height:50px;padding:0 14px;border-radius:12px;border:1.5px solid #25292f;background:#fff;color:#15181d;font-size:15px;font-weight:700;box-sizing:border-box;outline:none;-webkit-appearance:none;margin-bottom:16px;"/>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button id="__qx_bal_cancel__" style="min-height:46px;padding:13px;border-radius:12px;border:1.5px solid #15181d;background:#fff;color:#4d5551;font-size:13px;font-weight:800;cursor:pointer;-webkit-appearance:none;">Cancel</button>
            <button id="__qx_bal_confirm__" style="min-height:46px;padding:13px;border-radius:12px;border:2px solid #15181d;background:#65e7ae;color:#10251c;font-size:13px;font-weight:900;box-shadow:3px 3px 0 #15181d;cursor:pointer;-webkit-appearance:none;">✓ Apply</button>
          </div>
        </div>`;
      document.body.appendChild(pop);
      document.getElementById("__qx_bal_input__").focus();
      document.getElementById("__qx_bal_cancel__").addEventListener("click", () => pop.remove());
      pop.addEventListener("click", (e) => {
        if (e.target === pop) pop.remove();
      });
      document.getElementById("__qx_bal_confirm__").addEventListener("click", () => {
        const num = parseFloat(document.getElementById("__qx_bal_input__").value);
        if (isNaN(num)) return;
        const formatted = "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        CONFIG.customDemoDisplay = formatted;
        const demoLink = document.querySelector('a.yBslY[href*="demo"]');
        const demoBal = demoLink?.closest(".RDtBn")?.querySelector(".YnoT0");
        if (demoBal) demoBal.textContent = formatted;
        pop.remove();
      });
    });
    document.getElementById("__qx_rm_banner__").addEventListener("click", () => {
      CONFIG.removeBanner = true;
      // CSS inject karo - permanently hide karo
      if (!document.getElementById("__qx_banner_style__")) {
        const style = document.createElement("style");
        style.id = "__qx_banner_style__";
        style.textContent = `
          .r7UKG, .q04vx .r7UKG, .q04vx.o2msZ .r7UKG {
            display:none !important;
            visibility:hidden !important;
            opacity:0 !important;
            height:0 !important;
            max-height:0 !important;
            overflow:hidden !important;
            transform:none !important;
            animation:none !important;
            transition:none !important;
            pointer-events:none !important;
          }
        `;
        document.head.appendChild(style);
      }
      document.querySelectorAll(".r7UKG").forEach((el) => {
        el.setAttribute("style", "display:none !important");
        el.remove();
      });
      document.querySelectorAll(".q04vx").forEach((el) => {
        if (
          el.querySelector(".r7UKG") ||
          el.innerHTML.includes("r7UKG") ||
          el.innerHTML.includes("rocket-banner") ||
          el.innerHTML.includes("bonus")
        ) {
          el.setAttribute("style", "display:none !important");
        }
      });
      document.querySelectorAll(".r7UKG").forEach((el) => el.remove());
      // MutationObserver - banner appear hone se pehle hi remove karo
      let _bq = false;
      const _bannerObs = new MutationObserver(() => {
        if (!CONFIG.removeBanner || _bq) return;
        _bq = true;
        setTimeout(() => {
          _bq = false;
          document.querySelectorAll(".r7UKG").forEach((el) => {
            el.setAttribute("style", "display:none !important");
            el.remove();
          });
          document.querySelectorAll(".q04vx").forEach((el) => {
            if (el.innerHTML.includes("rocket-banner") || el.innerHTML.includes("bonus"))
              el.setAttribute("style", "display:none !important");
          });
        }, 400);
      });
      _bannerObs.observe(document.body, { childList: true, subtree: true });
    });
    document.getElementById("__qx_close__").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.getElementById("__qx_apply__").addEventListener("click", () => {
      applyPanelSettings();
      overlay.remove();
    });
  }

  // ============================================================
  // CORE FUNCTIONS
  // ============================================================

  // Address bar cleanup: show /trade instead of /trade-room (no reload, no navigation).
  function cleanTradeRoomURL() {
    try {
      const u = new URL(window.location.href);
      // Any trade variant (/trade-room, /trade_room, /trade2, /trade/..., etc.) -> /trade
      const m = u.pathname.match(/^(\/[a-z]{2})?\/trade([\/_-].*|\d+.*)?$/i);
      if (m && (m[1] !== undefined || m[2] !== undefined) && u.pathname !== (m[1] || "") + "/trade") {
        const clean = (m[1] || "") + "/trade";
        history.replaceState(null, "", clean + u.search + u.hash);
      }
    } catch (_) {}
  }

  function fixURL() {
    const href = window.location.href;
    for (const map of URL_MAP) {
      if (href.includes(map.demo)) {
        history.replaceState(null, "", map.live);
        break;
      }
    }
    cleanTradeRoomURL();
  }

  // New qx-usermenu-trigger (shadow DOM) helpers
  function getTriggerRoots() {
    const map = window.__mughalShadowRoots;
    const out = [];
    document.querySelectorAll("qx-usermenu-trigger").forEach((el) => {
      const r = el.shadowRoot || (map && map.get(el));
      if (r) out.push(r);
    });
    return out;
  }
  let __lastTriggerWritten = null,
    __realTriggerBal = null;
  const __observedTriggerRoots = new WeakSet();
  function observeTriggerRoot(root) {
    if (!root || __observedTriggerRoots.has(root)) return;
    __observedTriggerRoots.add(root);
    try {
      new MutationObserver(() => fixUsermenuTrigger()).observe(root, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    } catch (e) {}
  }
  function readTriggerBalance() {
    for (const r of getTriggerRoots()) {
      const b = r.querySelector(".balance");
      if (!b) continue;
      const t = b.textContent.trim();
      if (t && t !== __lastTriggerWritten) __realTriggerBal = t;
    }
    if (!__realTriggerBal) {
      // fallback: demo row in dropdown (original site value)
      const d = document.querySelector('a.yBslY[href*="demo"]')?.closest(".RDtBn")?.querySelector(".YnoT0");
      if (d && d.dataset.mughalW !== d.textContent) __realTriggerBal = d.textContent.trim();
    }
    if (!__realTriggerBal) return null;
    const n = parseFloat(__realTriggerBal.replace(/[$,\s]/g, ""));
    return isNaN(n) ? null : { text: __realTriggerBal, num: n };
  }
  function fixUsermenuTrigger() {
    const bal = getLiveBalance();
    const liveText = isMobile ? "Live" : "Live Account";
    getTriggerRoots().forEach((r) => {
      observeTriggerRoot(r);
      const name = r.querySelector(".name");
      if (name) {
        if (name.textContent !== liveText) name.textContent = liveText;
        name.classList.remove("demo");
        name.classList.add("live");
      }
      const b = r.querySelector(".balance");
      if (b && bal) {
        const txt = CONFIG.customDisplayBalance || bal.text;
        __lastTriggerWritten = txt;
        if (b.textContent !== txt) b.textContent = txt;
      }
      const use = r.querySelector("svg.icon use");
      if (use && bal) {
        const href = getLevelData(bal.num).href;
        if (use.getAttribute("xlink:href") !== href) use.setAttribute("xlink:href", href);
      }
    });
  }

  function getLiveBalance() {
    const tb = readTriggerBalance();
    if (tb && tb.num > 0) return tb;
    for (const sel of [
      ".Zt1hG",
      ".pVBHU",
      ".ti56_",
      ".---react-features-Usermenu-styles-module__infoBalance--pVBHU",
      ".usermenu__info-balance.js-balance-visible-usermenu",
    ]) {
      const el = document.querySelector(sel);
      if (el) {
        const n = parseFloat(el.textContent.replace(/[$,\s]/g, ""));
        if (!isNaN(n) && n > 0) return { text: el.textContent.trim(), num: n };
      }
    }
    const allBal = document.querySelectorAll(".balance__value");
    for (let i = 2; i >= 0; i--) {
      if (allBal[i]) {
        const n = parseFloat(allBal[i].textContent.replace(/[$,\s]/g, ""));
        if (!isNaN(n) && n > 0) return { text: allBal[i].textContent.trim(), num: n };
      }
    }
    return null;
  }

  // Dynamic PNL - balance vs baseBalance
  function getDynamicPNL() {
    const bal = getLiveBalance();
    if (!bal) return { text: "$0.00", color: "" };
    const diff = bal.num - CONFIG.baseBalance;
    if (diff === 0) return { text: "$0.00", color: "" };
    if (diff > 0) return { text: `+$${diff.toFixed(2)}`, color: "#4ade80" }; // green
    return { text: `-$${Math.abs(diff).toFixed(2)}`, color: "#f87171" }; // red
  }

  function getLeaderboardProfit() {
    const bal = getLiveBalance();
    if (!bal) return 0;
    return Math.max(0, bal.num - CONFIG.baseBalance);
  }

  function getLevelData(bal) {
    if (bal < 5000)
      return {
        href: "/profile/images/spritemap.svg#icon-profile-level-standart",
        name: "STANDARD:",
        profit: "+0% profit",
      };
    if (bal < 10000)
      return { href: "/profile/images/spritemap.svg#icon-profile-level-pro", name: "PRO:", profit: "+2% profit" };
    return { href: "/profile/images/spritemap.svg#icon-profile-level-vip", name: "VIP:", profit: "+4% profit" };
  }

  // Naya account-level badge (.Xun17) — balance ke hisaab se level + profit %
  function fixLevelBadge() {
    const bal = getLiveBalance();
    if (!bal) return;
    const level = getLevelData(bal.num);
    const nameTxt = level.name.toLowerCase();
    document.querySelectorAll(".Xun17").forEach((badge) => {
      const nameEl = badge.querySelector(".qjGlZ");
      if (nameEl && nameEl.textContent.trim().toLowerCase() !== nameTxt) nameEl.textContent = nameTxt;
      const pctEl = badge.querySelector(".VgpLl");
      if (pctEl && pctEl.textContent.trim() !== level.profit) pctEl.textContent = level.profit;
      const use = badge.querySelector(".nKm6H use");
      if (use) {
        if (use.getAttribute("xlink:href") !== level.href) use.setAttribute("xlink:href", level.href);
        if (use.getAttribute("href") !== level.href) use.setAttribute("href", level.href);
      }
    });
  }

  function syncBalanceAndLevel() {
    const bal = getLiveBalance();
    if (!bal) return;
    const liveClean = bal.text.replace("$", "") + "$";
    const level = getLevelData(bal.num);
    const svgHTML = `<svg class="icon-profile-level-standart"><use xlink:href="${level.href}"></use></svg>`;

    [
      ".Zt1hG",
      ".pVBHU",
      ".ti56_",
      ".---react-features-Usermenu-styles-module__infoBalance--pVBHU",
      ".usermenu__info-balance.js-balance-visible-usermenu",
      ".usermenu__select-balance.js-balance-visible-usermenu",
      ".---react-features-Usermenu-Dropdown-styles-module__selectBalance--IfQIW",
    ].forEach((sel) =>
      document.querySelectorAll(sel).forEach((el) => {
        el.textContent = CONFIG.customDisplayBalance || bal.text;
      }),
    );

    document.querySelectorAll(".balance__value").forEach((el) => (el.textContent = liveClean));
    document.querySelectorAll(".balance-list__value").forEach((el, i) => {
      if (i < 2) el.textContent = liveClean;
    });

    document.querySelectorAll(".analytics__profile-label").forEach((el) => {
      const v = el.parentElement.querySelector(".analytics__profile-value");
      if (!v) return;
      if (el.textContent.trim() === "In the account") v.textContent = bal.text;
      if (el.textContent.trim() === "In the demo") v.textContent = "$" + CONFIG.customDemoBalance;
    });

    document.querySelectorAll("use").forEach((el) => {
      const h = el.getAttribute("xlink:href") || el.getAttribute("href") || "";
      if (h.includes("icon-academic") || (h.includes("icon-profile-level") && !h.includes(level.href.split("#")[1]))) {
        el.setAttribute("xlink:href", level.href);
        el.setAttribute("href", level.href);
      }
    });
    document.querySelectorAll("svg.icon-academic").forEach((svg) => {
      svg.classList.remove("icon-academic");
      svg.classList.add("icon-profile-level-standart");
    });

    const lI = document.getElementsByClassName(
      "---react-features-Usermenu-Dropdown-styles-module__levelIcon--lmj_k",
    )[0];
    if (lI) lI.innerHTML = svgHTML;
    const lN = document.getElementsByClassName(
      "---react-features-Usermenu-Dropdown-styles-module__levelName--wFviC",
    )[0];
    if (lN) lN.innerHTML = level.name;
    const lP = document.getElementsByClassName(
      "---react-features-Usermenu-Dropdown-styles-module__levelProfit--UkDJi",
    )[0];
    if (lP) lP.innerHTML = level.profit;
    document.querySelectorAll("[class*='levelIcon']").forEach((el) => (el.innerHTML = svgHTML));
  }

  let __qxLeaderboardTarget = null;
  let __qxLeaderboardSignature = "";
  let __qxLeaderboardTimer = 0;
  // null means the broker's own no-logo avatar has not been seen yet.
  // An empty string is still a valid baseline when the broker draws it with CSS.
  let __qxOwnAvatarMarkup = null;
  const __qxDefaultAvatarMarkup =
    '<svg class="icon-avatar-default" data-qx-default-avatar="1" aria-label="Default profile avatar"><use href="/profile/images/spritemap.svg#icon-avatar-default" xlink:href="/profile/images/spritemap.svg#icon-avatar-default"></use></svg>';

  function findLeaderboardAvatar(root) {
    if (!root) return null;
    // Current broker row: .bCjpw + .spCR5 > ... > .HPYiu > .QyASJ
    const direct = root.querySelector(".bCjpw + .spCR5 .HPYiu .QyASJ, .HPYiu .QyASJ, .QyASJ, [class*='avatar' i]");
    if (direct) return direct;
    // Broker class names can change. Find the small visual immediately before
    // the profile name, excluding country flags and level badges.
    const name = root.querySelector(".hKWVz, [class*='name' i]");
    const candidates = Array.from(root.querySelectorAll("div,span")).filter((el) => {
      if (el === name || el.contains(name)) return false;
      if (el.closest(".HPYiu") || el.querySelector("[class*='flag' i],use[href*='flag'],use[xlink\\:href*='flag']")) return false;
      if (!el.querySelector("img,svg") && !/avatar|profile|userpic|picture/i.test(el.className || "")) return false;
      const rect = el.getBoundingClientRect();
      return rect.width >= 18 && rect.width <= 64 && rect.height >= 18 && rect.height <= 64;
    });
    return candidates.sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length)[0] || null;
  }

  function findOwnLeaderboardRow() {
    // Never use a ranked .CYmPX row as the source of our default avatar.
    // querySelector() with the old comma-list returned the first DOM match,
    // which could be a stranger's ranked row even though .Bsca8 was listed first.
    const ownPanel = document.querySelector(".egHS4");
    const known =
      (ownPanel?.classList.contains("Bsca8") ? ownPanel : null) ||
      ownPanel?.querySelector(":scope > .Bsca8") ||
      ownPanel?.querySelector(".Bsca8:not(.CYmPX)");
    if (known && !known.classList.contains("CYmPX")) return known;
    const position = document.querySelector(".c_7BP");
    const positionPanel = position?.closest(".egHS4") || position?.parentElement || null;
    if (!positionPanel) return null;
    const rows = Array.from(positionPanel.querySelectorAll(".Bsca8")).filter(
      (row) => !row.classList.contains("CYmPX") && !row.closest(".CYmPX"),
    );
    for (const row of rows) {
      if (findLeaderboardAvatar(row) && row.querySelector(".hKWVz, [class*='name' i]")) return row;
    }
    return null;
  }

  function parseLbMoney(t) {
    return parseFloat(String(t || "").replace(/[$,+\s]/g, "")) || 0;
  }

  // True when the broker re-rendered our modified row (our name no longer there)
  function lbRowIsStale(row) {
    const name = row?.querySelector(".hKWVz");
    return !name || name.dataset.qxLbOriginalName === undefined || name.textContent !== CONFIG.lname;
  }

  // Drop saved originals without writing old markup back (row now holds someone else's data)
  function forgetLeaderboardRow(row) {
    if (!row) return;
    row.querySelectorAll("[data-qx-lb-original-name],[data-qx-lb-original-profit],[data-qx-av-original],[data-qx-lb-original-flag]").forEach((el) => {
      delete el.dataset.qxLbOriginalName;
      delete el.dataset.qxLbOriginalProfit;
      delete el.dataset.qxLbOriginalColor;
      delete el.dataset.qxLbOriginalWeight;
      delete el.dataset.qxAvOriginal;
      delete el.dataset.qxAppliedAvatar;
      delete el.dataset.qxLbOriginalFlag;
    });
    delete row.dataset.qxMine;
  }

  // Live profit of a row; only our own modified row uses its saved original value
  function readLeaderboardProfit(row) {
    if (!row) return 0;
    const amount = row.querySelector(".ePgNa.iXGFm, .ePgNa, .ord28");
    if (!amount) return 0;
    if (row === __qxLeaderboardTarget && amount.dataset.qxLbOriginalProfit !== undefined && !lbRowIsStale(row)) {
      return parseLbMoney(amount.dataset.qxLbOriginalProfit);
    }
    return parseLbMoney(amount.textContent);
  }

  function applyFlagIn(root) {
    if (!root || !CONFIG.flagCode) return;
    const code = CONFIG.flagCode;
    root.querySelectorAll("svg").forEach((svg) => {
      const use = svg.querySelector("use");
      const href = use ? use.getAttribute("href") || use.getAttribute("xlink:href") || "" : "";
      const cls = svg.getAttribute("class") || "";
      if (!/flag/i.test(href + " " + cls)) return;
      if (href.endsWith("#" + code) && cls.includes(code)) return;
      svg.setAttribute("class", cls.replace(/\bflag-[a-z]{2}\b/gi, "").trim() + " " + code);
      svg.setAttribute("aria-label", "Flag " + code.replace("flag-", "").toUpperCase());
      if (use) {
        const base = (href.split("#")[0] || "/profile/images/flags.svg");
        use.setAttribute("href", `${base}#${code}`);
        use.setAttribute("xlink:href", `${base}#${code}`);
      }
    });
    root.querySelectorAll("img[src*='flag'],img[alt*='flag' i]").forEach((img) => {
      const cc = code.replace("flag-", "");
      const next = img.src.replace(/([\/_-])[a-z]{2}(\.(svg|png|webp))/i, `$1${cc}$2`);
      if (next !== img.src) img.src = next;
    });
  }

  function scheduleLeaderboardRefresh(delay = 60) {
    clearTimeout(__qxLeaderboardTimer);
    __qxLeaderboardTimer = setTimeout(() => {
      __qxLeaderboardTimer = 0;
      fixLeaderboard();
    }, delay);
  }

  function restoreLeaderboardRow(row) {
    if (!row) return;
    if (!row.isConnected || lbRowIsStale(row)) return forgetLeaderboardRow(row);
    const name = row.querySelector(".hKWVz");
    if (name?.dataset.qxLbOriginalName !== undefined) {
      name.textContent = name.dataset.qxLbOriginalName;
      delete name.dataset.qxLbOriginalName;
    }
    const amount = row.querySelector(".ePgNa.iXGFm, .ePgNa, .ord28");
    if (amount?.dataset.qxLbOriginalProfit !== undefined) {
      amount.textContent = amount.dataset.qxLbOriginalProfit;
      amount.style.color = amount.dataset.qxLbOriginalColor || "";
      amount.style.fontWeight = amount.dataset.qxLbOriginalWeight || "";
      delete amount.dataset.qxLbOriginalProfit;
      delete amount.dataset.qxLbOriginalColor;
      delete amount.dataset.qxLbOriginalWeight;
    }
    const avatar = findLeaderboardAvatar(row);
    if (avatar?.dataset.qxAvOriginal !== undefined) {
      avatar.innerHTML = avatar.dataset.qxAvOriginal;
      delete avatar.dataset.qxAvOriginal;
      delete avatar.dataset.qxAppliedAvatar;
    }
    const flagWrap = row.querySelector(".HPYiu");
    if (flagWrap?.dataset.qxLbOriginalFlag !== undefined) {
      flagWrap.innerHTML = flagWrap.dataset.qxLbOriginalFlag;
      delete flagWrap.dataset.qxLbOriginalFlag;
    }
    delete row.dataset.qxMine;
  }

  // .JPftH sidebar summary: the profile name shown there also follows the
  // leaderboard name set in the panel (same as the ranked row and tooltip).
  function fixSidebarSummaryName(myRow, pnlEl) {
    document.querySelectorAll(".egHS4 .Bsca8:not(.CYmPX) .d6ijp p, .egHS4 .d6ijp p").forEach((p) => {
      if (p.textContent !== CONFIG.lname) p.textContent = CONFIG.lname;
    });
    const summary = (myRow && myRow.closest(".JPftH")) || document.querySelector(".JPftH");
    if (!summary || !summary.childElementCount) return;
    let nameEl = summary.querySelector(".hKWVz");
    if (!nameEl) {
      const candidates = Array.from(summary.querySelectorAll("span, div, p")).filter((el) => {
        if (el.dataset?.qxLbSummaryName !== undefined || el.dataset?.qxLbOriginalName !== undefined) return false;
        if (el.closest("button, a, .HPYiu, .Xun17, [class*='badge' i], [class*='level' i], #__qx_")) return false;
        if (pnlEl && (el === pnlEl || pnlEl.contains(el) || el.contains(pnlEl))) return false;
        if (el.querySelector("svg, img, button, a")) return false;
        const txt = (el.textContent || "").trim();
        if (!txt || txt.length < 2 || txt.length > 40) return false;
        if (txt.includes("$") || /\d/.test(txt) || /[%:]/.test(txt)) return false;
        if (/^(live|demo|account|balance|profile|deposit|free|bonus|standard|pro|vip)/i.test(txt)) return false;
        return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      });
      nameEl = candidates.sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length)[0] || null;
    }
    if (!nameEl) return;
    if (nameEl.dataset.qxLbSummaryName === undefined) nameEl.dataset.qxLbSummaryName = nameEl.textContent || "";
    if (nameEl.textContent !== CONFIG.lname) nameEl.textContent = CONFIG.lname;
  }

  function fixLeaderboard() {
    const pnl = getDynamicPNL();
    const myBal = getLiveBalance();
    const myBalNum = myBal ? myBal.num : 0;
    const myProfit = getLeaderboardProfit();

    // ---- SIDEBAR ROW (user ki apni row - egHS4 container) ----
    let myRow = null;
    myRow = findOwnLeaderboardRow();

    if (myRow) {
      const nameEl = myRow.querySelector(".hKWVz") || myRow.querySelector(".d6ijp p") || myRow.querySelector(".d6ijp > :not(svg):not(img)");
      if (nameEl && nameEl.textContent !== CONFIG.lname) nameEl.textContent = CONFIG.lname;

      const pnlNum = Math.abs(myBalNum - CONFIG.baseBalance);
      // Own .JPftH/sidebar summary always shows the complete actual profit; only ranked rows are capped.
      const pnlFormatted = pnlNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const pnlVal = pnl.color === "#f87171" ? pnlFormatted + "$" : "$" + pnlFormatted;
      const pnlColor = pnl.color === "#4ade80" ? "rgb(15,175,89)" : pnl.color === "#f87171" ? "rgb(235,64,52)" : "";

      const pnlEl = myRow.querySelector(".ePgNa") || myRow.querySelector(".ord28");
      if (pnlEl) {
        pnlEl.textContent = pnlVal;
        pnlEl.style.color = pnlColor;
        pnlEl.style.fontWeight = pnlColor ? "700" : "";
      }

      applyFlagIn(myRow.querySelector(".HPYiu") || myRow);
      applyLeaderboardAvatar(myRow, true);
    }

    // Sidebar summary (.JPftH) name bhi panel wale leaderboard name ko follow kare
    try { fixSidebarSummaryName(myRow, myRow?.querySelector(".ePgNa") || myRow?.querySelector(".ord28") || null); } catch (e) {}

    // ---- MAIN LEADERBOARD ----
    const allRows = document.querySelectorAll(".CYmPX");
    if (!allRows.length) {
      _updatePositionOnly("100+");
      return;
    }

    const rowProfits = Array.from(allRows, readLeaderboardProfit);
    // If the broker re-rendered/reused our target row, forget stale originals so the real person is never overwritten with old data
    if (__qxLeaderboardTarget && (!__qxLeaderboardTarget.isConnected || lbRowIsStale(__qxLeaderboardTarget))) {
      forgetLeaderboardRow(__qxLeaderboardTarget);
      __qxLeaderboardTarget = null;
      __qxLeaderboardSignature = "";
    }
    const rowNames = Array.from(allRows, (r) => (r === __qxLeaderboardTarget ? "*" : r.querySelector(".hKWVz")?.textContent || "")).join("|");
    const activeAvatar = __qxLeaderboardTarget ? findLeaderboardAvatar(__qxLeaderboardTarget) : null;
    const avatarReady = CONFIG.leaderboardAvatar
      ? !!activeAvatar?.querySelector("img[data-qx-logo='1']")
      : !!activeAvatar?.querySelector('[data-qx-default-avatar="1"]');
    const signature = `${allRows.length}|${myProfit.toFixed(2)}|${rowProfits.join(",")}|${rowNames}|${CONFIG.lname}|${CONFIG.flagCode}|${__qxLeaderboardAvatarVersion}|${avatarReady}`;
    if (signature === __qxLeaderboardSignature && __qxLeaderboardTarget?.isConnected) return;
    __qxLeaderboardSignature = signature;

    const lastVisibleProfit = rowProfits[rowProfits.length - 1] || 0;
    if (myBalNum <= 0 || myProfit <= 0 || myProfit < lastVisibleProfit) {
      restoreLeaderboardRow(__qxLeaderboardTarget);
      __qxLeaderboardTarget = null;
      _updatePositionOnly("100+");
      return;
    }

    let targetIdx = allRows.length - 1;
    for (let i = 0; i < rowProfits.length; i++) {
      if (myProfit >= rowProfits[i]) {
        targetIdx = i;
        break;
      }
    }

    const targetRow = allRows[targetIdx];
    if (!targetRow) return;
    if (__qxLeaderboardTarget && __qxLeaderboardTarget !== targetRow) restoreLeaderboardRow(__qxLeaderboardTarget);
    __qxLeaderboardTarget = targetRow;

    const tName = targetRow.querySelector(".hKWVz");
    if (tName) {
      if (tName.dataset.qxLbOriginalName === undefined) tName.dataset.qxLbOriginalName = tName.textContent || "";
      if (tName.textContent !== CONFIG.lname) tName.textContent = CONFIG.lname;
    }

    const flagWrap = targetRow.querySelector(".HPYiu");
    if (flagWrap) {
      if (flagWrap.dataset.qxLbOriginalFlag === undefined) flagWrap.dataset.qxLbOriginalFlag = flagWrap.innerHTML;
      applyFlagIn(flagWrap);
    }

    const tBal = targetRow.querySelector(".ePgNa.iXGFm");
    if (tBal) {
      if (tBal.dataset.qxLbOriginalProfit === undefined) {
        tBal.dataset.qxLbOriginalProfit = tBal.textContent?.trim() || "$0";
        tBal.dataset.qxLbOriginalColor = tBal.style.color || "";
        tBal.dataset.qxLbOriginalWeight = tBal.style.fontWeight || "";
      }
      // $30,000 se zyada profit = broker wala capped "$30,000.00+" text
      const formatted = myProfit > 30000 ? "30,000.00+" : myProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      tBal.textContent = "$" + formatted;
      tBal.style.color = "rgb(15,175,89)";
      tBal.style.fontWeight = "700";
    }

    applyLeaderboardAvatar(targetRow);

    const myLeaderPos = targetIdx + 1;
    CONFIG.customPosition = String(myLeaderPos);
    _updatePositionOnly(myLeaderPos);
    if (CONFIG.greenLinePct > 0) _updateGreenLine(CONFIG.greenLinePct);
  }

  function markMyLeaderboardRow(row) {
    document.querySelectorAll('[data-qx-mine="1"]').forEach((r) => {
      if (r !== row) delete r.dataset.qxMine;
    });
    if (row) row.dataset.qxMine = "1";
  }

  function formatLbMoney(v) {
    const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
    if (isNaN(n)) return String(v);
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatLbCount(v) {
    const n = parseFloat(String(v).replace(/[,\s]/g, ""));
    return isNaN(n) ? String(v) : Math.round(n).toLocaleString("en-US");
  }

  // Applies the configured stats/logo to the broker hover card (.lH01n) — only for our own row
  function fixLeaderboardTooltip() {
    const card = document.querySelector(".lH01n");
    if (!card || !window.__qxHoverMine) return;
    const nameP = card.querySelector(".CbMCx p");
    if (nameP && nameP.textContent !== CONFIG.lname) nameP.textContent = CONFIG.lname;
    const countryEl = card.querySelector(".B5Vqs");
    const countryName = getLeaderboardCountry();
    if (countryEl && countryEl.textContent !== countryName) countryEl.textContent = countryName;
    applyFlagIn(card);
    const av = card.querySelector(".WIZBd");
    if (av) {
      if (CONFIG.leaderboardAvatar) {
        if (av.dataset.qxAvOriginal === undefined) av.dataset.qxAvOriginal = av.innerHTML;
        const cur = av.querySelector("img[data-qx-logo='1']");
        if (!cur || cur.src !== CONFIG.leaderboardAvatar) {
          const img = document.createElement("img");
          img.dataset.qxLogo = "1";
          img.src = CONFIG.leaderboardAvatar;
          img.alt = "avatar";
          img.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;";
          av.replaceChildren(img);
        }
      } else {
        if (av.dataset.qxAvOriginal === undefined) av.dataset.qxAvOriginal = av.innerHTML;
        if (!av.querySelector('[data-qx-default-avatar="1"]')) av.innerHTML = __qxDefaultAvatarMarkup;
        delete av.dataset.qxAvOriginal;
      }
    }
    const map = {
      "trades count": ["count", formatLbCount],
      "profitable trades": ["profitable", formatLbCount],
      "trades profit": ["profit", formatLbMoney],
      "average profit": ["average", formatLbMoney],
      "min trade amount": ["min", formatLbMoney],
      "max trade amount": ["max", formatLbMoney],
    };
    card.querySelectorAll(".YL5hN").forEach((cell) => {
      const label = (cell.querySelector(".ROY0t")?.textContent || "").trim().toLowerCase();
      const valEl = cell.querySelector(".hN0NY");
      const entry = map[label];
      if (!valEl || !entry) return;
      if (valEl.dataset.qxOrig === undefined) valEl.dataset.qxOrig = valEl.textContent;
      const raw = CONFIG.lbStats[entry[0]];
      const next = raw ? entry[1](raw) : valEl.dataset.qxOrig;
      if (valEl.textContent !== next) valEl.textContent = next;
    });
  }

  function installLeaderboardTooltipHook() {
    if (window.__qxLbTipHook) return;
    window.__qxLbTipHook = true;
    let tooltipFrame = 0;
    let tooltipTimers = [];
    let cardObserver = null;
    let observerStopTimer = 0;
    const run = () => {
      cancelAnimationFrame(tooltipFrame);
      tooltipTimers.forEach(clearTimeout);
      fixLeaderboardTooltip();
      tooltipFrame = requestAnimationFrame(fixLeaderboardTooltip);
      tooltipTimers = [40, 100].map((delay) => setTimeout(fixLeaderboardTooltip, delay));
    };
    const stopWatching = () => {
      cardObserver?.disconnect();
      cardObserver = null;
      clearTimeout(observerStopTimer);
      observerStopTimer = 0;
    };
    const watchForCard = () => {
      stopWatching();
      cardObserver = new MutationObserver((mutations) => {
        if (!window.__qxHoverMine) return stopWatching();
        const cardAdded = mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some(
            (node) => node.nodeType === 1 && (node.matches?.(".lH01n") || node.querySelector?.(".lH01n")),
          ),
        );
        if (cardAdded || document.querySelector(".lH01n")) run();
      });
      cardObserver.observe(document.body, { childList: true, subtree: true });
      observerStopTimer = setTimeout(stopWatching, 450);
    };
    document.addEventListener(
      "pointerover",
      (e) => {
        const row = e.target && e.target.closest ? e.target.closest(".CYmPX, .Bsca8") : null;
        if (!row) return;
        const mine = row.dataset.qxMine === "1";
        if (mine !== !!window.__qxHoverMine) {
          window.__qxHoverMine = mine;
          if (mine) {
            run();
            watchForCard();
          } else stopWatching();
        }
      },
      true,
    );
    document.addEventListener(
      "click",
      (e) => {
        const row = e.target && e.target.closest ? e.target.closest(".CYmPX, .Bsca8") : null;
        if (!row) return;
        window.__qxHoverMine = row.dataset.qxMine === "1";
        if (window.__qxHoverMine) {
          run();
          watchForCard();
        } else stopWatching();
      },
      true,
    );
  }

  function applyLeaderboardAvatar(row, isOwnSidebar = false) {
    if (!row) return;
    if (row.classList.contains("CYmPX")) markMyLeaderboardRow(row);
    else row.dataset.qxMine = "1";
    const avatar = findLeaderboardAvatar(row);
    if (!avatar) return;
    // Capture only the authenticated profile's broker avatar, never a ranked
    // stranger's avatar. This is the source used for the no-logo state.
    if (isOwnSidebar && __qxOwnAvatarMarkup === null) {
      const savedOriginal = avatar.dataset.qxAvOriginal;
      const hasInjectedLogo = !!avatar.querySelector("img[data-qx-logo='1']");
      if (savedOriginal !== undefined) __qxOwnAvatarMarkup = savedOriginal;
      else if (!hasInjectedLogo) __qxOwnAvatarMarkup = avatar.innerHTML;
    }
    if (!CONFIG.leaderboardAvatar) {
      // Ranked rows keep their own avatar separately for later restoration, but
      // our configured row always gets a deterministic blue no-logo icon. Do
      // not rely on copied broker markup: React may recycle it from a stranger.
      if (!isOwnSidebar && avatar.dataset.qxAvOriginal === undefined)
        avatar.dataset.qxAvOriginal = avatar.innerHTML;
      if (!avatar.querySelector('[data-qx-default-avatar="1"]')) avatar.innerHTML = __qxDefaultAvatarMarkup;
      delete avatar.dataset.qxAppliedAvatar;
      if (isOwnSidebar) delete avatar.dataset.qxAvOriginal;
      return;
    }
    // Save the original avatar content once so it can be restored on remove
    if (avatar.dataset.qxAvOriginal === undefined) {
      avatar.dataset.qxAvOriginal = avatar.innerHTML;
      if (isOwnSidebar && __qxOwnAvatarMarkup === null) __qxOwnAvatarMarkup = avatar.innerHTML;
    }
    const avatarVersion = String(__qxLeaderboardAvatarVersion);
    if (avatar.dataset.qxAppliedAvatar === avatarVersion && avatar.querySelector("img[data-qx-logo='1']")) return;
    let img = avatar.querySelector("img[data-qx-logo='1']");
    if (!img) {
      img = document.createElement("img");
      img.dataset.qxLogo = "1";
      img.alt = "avatar";
      img.style.cssText = "width:100%;height:100%;min-width:16px;min-height:16px;border-radius:50%;object-fit:cover;display:block;";
      avatar.replaceChildren(img);
    }
    img.src = CONFIG.leaderboardAvatar;
    avatar.dataset.qxAppliedAvatar = avatarVersion;
  }

  function _updateGreenLine(pct) {
    document.querySelectorAll(".DRWB2 .uQuVa").forEach((span) => {
      span.style.width = pct + "%";
    });
  }

  function _updatePositionOnly(pos) {
    if (CONFIG.greenLinePct > 0) _updateGreenLine(CONFIG.greenLinePct);
    // c_7BP - "Your position: -" wala element
    document.querySelectorAll(".c_7BP").forEach((el) => {
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = pos;
      });
    });
    // cyopB + QQBcT - sidebar position
    document.querySelectorAll(".cyopB, .QQBcT").forEach((el) => {
      if (el.closest(".BQxBK")) el.textContent = pos;
    });
    // iKtL6 - old fallback
    document.querySelectorAll(".iKtL6").forEach((el) => {
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = " " + pos;
      });
    });
    // epZ1E - old fallback
    document.querySelectorAll(".epZ1E").forEach((el) => {
      if (!el.closest(".zoZnf") && !el.closest('[class*="notification"]')) el.textContent = pos;
    });
    document.querySelectorAll('[class*="myPosition"],[class*="my-position"],[class*="yourRank"]').forEach((el) => {
      el.textContent = pos;
    });
  }

  // Mobile detection
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768;

  function fixAccountBadge() {
    const liveText = isMobile ? "Live" : "Live Account";

    // v2KPX - new account type badge
    document.querySelectorAll(".v2KPX").forEach((el) => {
      const t = el.textContent.trim();
      if (t === "Demo Account" || t === "Demo" || t === "Live Account") {
        el.textContent = liveText;
        el.classList.add("X6PB5");
        el.style.color = "rgb(15, 175, 89)";
      }
    });

    // SfrTV - old badge fallback
    document.querySelectorAll(".SfrTV").forEach((el) => {
      const t = el.textContent.trim();
      if (t === "Demo Account" || t === "Demo" || t === "Live Account") {
        el.textContent = liveText;
        el.classList.remove("TmWTp");
        el.classList.add("Bx7Ua");
      }
    });

    // Generic fallback
    document.querySelectorAll(".gG3dg.yQ5k8, .gG3dg").forEach((el) => {
      if (el.children.length === 0 && (el.textContent.trim() === "Demo" || el.textContent.trim() === "Demo Account"))
        el.textContent = liveText;
    });

    // Dropdown window - Live Account ko active karo, Demo ko inactive
    const liveLink = document.querySelector('a.yBslY[href*="/en/trade"]:not([href*="demo"])');
    const demoLink = document.querySelector('a.yBslY[href*="demo"]');
    if (liveLink) {
      liveLink.setAttribute("aria-current", "page");
      liveLink.classList.add("active");
      liveLink.closest(".RDtBn")?.classList.add("Qx5RW");
    }
    if (demoLink) {
      demoLink.removeAttribute("aria-current");
      demoLink.classList.remove("active");
      demoLink.closest(".RDtBn")?.classList.remove("Qx5RW");
    }

    // Radio buttons: Live checked, Demo unchecked
    const liveRadio = liveLink?.querySelector('input[type="radio"]');
    const demoRadio = demoLink?.querySelector('input[type="radio"]');
    if (liveRadio) {
      liveRadio.checked = true;
      liveRadio.setAttribute("checked", "");
    }
    if (demoRadio) {
      demoRadio.checked = false;
      demoRadio.removeAttribute("checked");
    }

    // Demo balance ko Live balance par show karo
    const bal = getLiveBalance();
    const liveBal = liveLink?.closest(".RDtBn")?.querySelector(".YnoT0");
    if (liveBal && bal) {
      const txt = CONFIG.customDisplayBalance || bal.text;
      if (liveBal.textContent !== txt) liveBal.textContent = txt;
    }

    // Demo neeche wala - custom value
    const demoBal2 = demoLink?.closest(".RDtBn")?.querySelector(".YnoT0");
    if (demoBal2 && CONFIG.customDemoDisplay) {
      demoBal2.textContent = CONFIG.customDemoDisplay;
      demoBal2.dataset.mughalW = CONFIG.customDemoDisplay;
    }

    // New top account button (shadow DOM)
    fixUsermenuTrigger();

    // Dropdown row (div.root) layout fix - mobile pe position theek rakho
    fixDropdownRowLayout();
  }

  // --- Fullscreen action lives inside the BC control menu ---
  function goFullscreenNow() {
    try {
      const el = document.body || document.documentElement;
      const fn =
        el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.msRequestFullscreen;
      if (fn) fn.call(el);
    } catch (e) {
      /* ignore */
    }
  }

  function installDepositFullscreen() {
    if (window.__qxDepFsInstalled) return;
    window.__qxDepFsInstalled = true;
    document.addEventListener(
      "click",
      function (ev) {
        const t = ev.target && ev.target.closest ? ev.target.closest("button,a") : null;
        if (!t) return;
        if ((t.id && t.id.indexOf("__qx_") === 0) || t.closest('[id^="__qx_"], #mughal-gate')) return;
        const txt = (t.textContent || "").trim();
        if (!/^deposit$/i.test(txt)) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        showPopup();
      },
      true,
    );
  }

  // --- Account dropdown row (div.root > svg.icon + div.text + svg.caret) layout fix ---
  function fixDropdownRowLayout() {
    if (document.getElementById("__qx_row_fix__")) return;
    const st = document.createElement("style");
    st.id = "__qx_row_fix__";
    st.textContent = `
      div.root:has(> .text > .name){display:flex!important;align-items:center!important;gap:10px;width:100%!important;box-sizing:border-box!important;}
      div.root > .text{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-direction:column!important;gap:2px!important;overflow:hidden!important;}
      div.root > .text .name,div.root > .text .balance{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;line-height:1.25!important;}
      div.root > svg.icon,div.root > svg.caret{flex:0 0 auto!important;}
      div.root > svg.caret{margin-left:auto!important;}
      @media (max-width:768px){
        div.root:has(> .text > .name){gap:8px!important;}
        div.root > .text .balance{font-size:13px!important;}
        div.root > .text .name{font-size:12px!important;}
      }`;
    document.head.appendChild(st);
  }

  function setRealActive() {
    const ac = "---react-features-Usermenu-Dropdown-styles-module__active--P5n2A";
    const oldItems = document.querySelectorAll(".usermenu__select-item.usermenu__select-item--radio");
    if (oldItems[0]) oldItems[0].setAttribute("id", "real1");
    if (oldItems[1]) oldItems[1].setAttribute("id", "demo1");
    const ri = document.querySelectorAll("[class*='selectItem'][class*='selectItemRadio']");
    if (ri[0]) {
      ri[0].setAttribute("id", "real1");
      ri[0].classList.add(ac);
    }
    if (ri[1]) {
      ri[1].setAttribute("id", "demo1");
      ri[1].classList.remove(ac);
    }
    const r = document.getElementById("real1");
    if (r) r.classList.add(ac);
    const d = document.getElementById("demo1");
    if (d) d.classList.remove(ac);
  }

  function interceptHistory() {
    const oP = history.pushState;
    history.pushState = function (...a) {
      oP.apply(this, a);
      fixURL();
      scheduleAccountRestore();
    };
    const oR = history.replaceState;
    history.replaceState = function (...a) {
      oR.apply(this, a);
      if (URL_MAP.some((m) => window.location.href.includes(m.demo)))
        setTimeout(() => {
          for (const map of URL_MAP) {
            if (window.location.href.includes(map.demo)) {
              oR.apply(history, [null, "", map.live]);
              break;
            }
          }
        }, 30);
      scheduleAccountRestore();
    };
  }

  // --- Payments / balance page: force Live account look, kill demo traces ---
  function fixPaymentsPage() {
    const href = window.location.href;
    if (!/\/(balance|payments|deposit|withdraw|cashier|profile)/i.test(href)) return;
    const liveText = isMobile ? "Live" : "Live Account";
    const bal = getLiveBalance();

    // Any visible "Demo" account label on the payments screens -> Live
    // (neeche wale demo switcher row ko chhod do - wo pehle jaisa hi rahega)
    const demoRows = [];
    document.querySelectorAll('input[type="radio"][value="demo"]').forEach((r) => {
      const row = r.closest("label") || r.parentElement;
      if (row) demoRows.push(row);
    });
    const inDemoRow = (el) => demoRows.some((row) => row.contains(el));
    document
      .querySelectorAll(
        '[class*="account"],[class*="Account"],[class*="tab"],[class*="Tab"],[class*="badge"],[class*="Badge"],[class*="select"],span,div,button,a',
      )
      .forEach((el) => {
        if (el.children.length) return;
        if (inDemoRow(el)) return;
        const t = (el.textContent || "").trim();
        if (t === "Demo" || t === "Demo Account" || t === "Demo account" || t === "DEMO") {
          el.textContent = liveText;
          el.style.color = "rgb(15, 175, 89)";
        }
      });

    // Balance shown on payments header = live balance
    if (bal) {
      document.querySelectorAll('.balance__value,[class*="balanceValue"],[class*="headBalance"]').forEach((el) => {
        el.textContent = bal.text.replace("$", "") + "$";
      });
    }

    // Account switcher inside payments: Live selected, demo tick removed
    document.querySelectorAll('input[type="radio"][value="demo"]').forEach((r) => {
      const lbl = r.nextElementSibling;
      lbl?.querySelectorAll(".RUgzE").forEach((t) => {
        t.style.setProperty("opacity", "0", "important");
        t.style.setProperty("transform", "scale(0)", "important");
        t.style.setProperty("background", "transparent", "important");
      });
    });
    document.querySelectorAll('input[type="radio"][value="live"]').forEach((r) => {
      const lbl = r.nextElementSibling;
      lbl?.querySelectorAll(".RUgzE").forEach((t) => {
        t.style.setProperty("opacity", "1", "important");
        t.style.setProperty("transform", "scale(1)", "important");
      });
    });
  }

  // --- Account switcher: force Live radio tick, hide Demo tick ---
  function applyLiveTickStyle() {
    let s = document.getElementById("mughal-live-tick");
    if (!s) {
      s = document.createElement("style");
      s.id = "mughal-live-tick";
      (document.head || document.documentElement).appendChild(s);
    }
    const css =
      'input[type="radio"][value="demo"] + .yJFvf .RUgzE{background:transparent!important}' +
      'input[type="radio"][value="demo"] + .yJFvf .RUgzE{transform:scale(0)!important;opacity:0!important}' +
      'input[type="radio"][value="live"] + .yJFvf .RUgzE{transform:scale(1)!important;opacity:1!important;}';
    if (s.textContent !== css) s.textContent = css;
  }

  // Keep account chrome stable without continuously scanning the trading page.
  let __accountFixing = false;
  let __accountRestoreTimers = [];
  function fixAccountChromeNow() {
    if (__accountFixing) return;
    __accountFixing = true;
    try {
      applyLiveTickStyle();
      fixAccountBadge();
      syncBalanceAndLevel();
      fixLevelBadge();
      setRealActive();
    } finally {
      __accountFixing = false;
    }
  }
  function holdLiveThroughInteraction() {
    fixAccountChromeNow();
    scheduleAccountRestore();
  }
  function scheduleAccountRestore() {
    __accountRestoreTimers.forEach(clearTimeout);
    __accountRestoreTimers = [0, 16, 60, 160, 400, 800, 1400, 2200].map((delay) =>
      setTimeout(fixAccountChromeNow, delay),
    );
    // Payment/back navigation ke baad broker DOM late rebuild karta hai,
    // isliye 3s tak halka burst chalao (heavy continuous scan nahi).
    if (window.__qxNavBurst) clearInterval(window.__qxNavBurst);
    let ticks = 0;
    window.__qxNavBurst = setInterval(() => {
      fixAccountChromeNow();
      if (++ticks >= 10) {
        clearInterval(window.__qxNavBurst);
        window.__qxNavBurst = null;
      }
    }, 300);
  }

  function runAll() {
    applyLiveTickStyle();
    syncBalanceAndLevel();
    fixLevelBadge();
    setRealActive();
    fixAccountBadge();
    fixBrokerAnalytics();
    scheduleLeaderboardRefresh();
    fixPaymentsPage();
    if (typeof window.__mughalCleanWatermark === "function") window.__mughalCleanWatermark();
    document.title = "Live trading | Quotex";
  }

  // --- MAIN ---
  applyLiveTickStyle();
  interceptHistory();
  fixURL();

  // License check pehle karo (async)
  checkLicense().then((valid) => {
    if (!valid) return;
    runAll();
    installDepositFullscreen();
    installLeaderboardTooltipHook();
    // 500ms interval
    let lastURL = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastURL) {
        lastURL = window.location.href;
        fixURL();
      }
      runAll();
    }, 1500);
    // Capture account presses before the broker's own handler can repaint Demo.
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.target?.closest?.('qx-usermenu-trigger, [class*="Usermenu"], [class*="usermenu"]'))
          holdLiveThroughInteraction();
      },
      true,
    );
    document.addEventListener(
      "click",
      (e) => {
        if (e.target?.closest?.('qx-usermenu-trigger, [class*="Usermenu"], [class*="usermenu"]'))
          holdLiveThroughInteraction();
      },
      true,
    );
    window.addEventListener("__mughal_shadow_attached__", () => {
      scheduleAccountRestore();
    });
    window.addEventListener("popstate", scheduleAccountRestore);
    window.addEventListener("pageshow", scheduleAccountRestore);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scheduleAccountRestore();
    });
   // Remote check removed
    // Only react immediately when navigation replaces the account trigger.
    // Regular trading DOM updates are ignored, keeping orders responsive.
    let _busy = false;
    new MutationObserver((mutations) => {
      if (_busy || __accountFixing) return;
      const accountChanged = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (node) =>
            node.nodeType === 1 &&
            (node.matches?.("qx-usermenu-trigger") || node.querySelector?.("qx-usermenu-trigger")),
        ),
      );
      if (!accountChanged) return;
      _busy = true;
      scheduleAccountRestore();
      setTimeout(() => {
        runAll();
        _busy = false;
      }, 180);
    }).observe(document.body, { childList: true, subtree: true });

    // Leaderboard open detect - app__sidepanel pe observer
    const _sidepanel = document.querySelector(".app__sidepanel");
    if (_sidepanel) {
      new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.classList && node.classList.contains("M_p_O")) {
              scheduleLeaderboardRefresh(120);
            }
          });
        });
      }).observe(_sidepanel, { childList: true });
    }

    // Leaderboard open/close observer - M_p_O container
    const _lbObserver = new MutationObserver((mutations) => {
      // Ignore our own text/avatar writes. Refresh only when the broker mounts
      // or replaces leaderboard rows/our active avatar. The latter is needed
      // because React can recycle a stranger's photo into the configured row.
      const rowsChanged = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === 1 &&
            !node.matches?.('[data-qx-default-avatar="1"],img[data-qx-logo="1"]') &&
            (node.matches?.(".CYmPX, .Bsca8") ||
              node.querySelector?.(".CYmPX, .Bsca8") ||
              mutation.target?.closest?.('[data-qx-mine="1"]')),
        ),
      );
      if (rowsChanged) scheduleLeaderboardRefresh(40);
    });
    const _lbWait = setInterval(() => {
      const lbParent = document.querySelector(".M_p_O");
      if (lbParent) {
        _lbObserver.observe(lbParent, { childList: true, subtree: true });
        clearInterval(_lbWait);
      }
    }, 500);
  });
})();
(function () {
  "use strict";
  if (!document.getElementById("fake-txn-style")) {
    const s = document.createElement("style");
    s.id = "fake-txn-style";
    s.innerHTML = `#fake-txn-modal{display:none;position:fixed;inset:0;width:100%;height:100%;background:rgba(21,24,29,.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:999999;justify-content:center;align-items:center;font-family:"DM Sans",sans-serif;}#fake-txn-content{background:#fffbe8;padding:24px;border-radius:22px;width:min(420px,calc(100vw - 28px));color:#15181d;box-shadow:6px 6px 0 #15181d;border:2px solid #15181d;max-height:min(88vh,720px);overflow-y:auto;box-sizing:border-box;}#fake-txn-content h3{margin:0;color:#15181d;font-family:"Space Grotesk",sans-serif;font-size:22px;font-weight:800;letter-spacing:-.5px;display:flex;align-items:center;}#fake-txn-content h3 span{display:flex;align-items:center;gap:8px;}#fake-txn-content h3 span:before{content:"BC";display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;background:#65e7ae;border:2px solid #15181d;border-radius:10px;font-size:13px;font-weight:900;box-shadow:2px 2px 0 #15181d;}.ft-subtitle{font-size:12px;color:#66706b;margin:8px 0 20px;border-bottom:2px solid #15181d;padding:0 0 14px;font-weight:600;}.ft-group{margin-bottom:15px;}.ft-group label{display:block;font-size:12px;color:#15181d;margin-bottom:7px;font-weight:800;}.ft-group input,.ft-group select{width:100%;padding:11px 12px;background:#f7f8f5;border:1.8px solid #15181d;border-radius:12px;color:#15181d;box-sizing:border-box;font-size:14px;font-family:"DM Sans",sans-serif;font-weight:600;outline:none;transition:.15s ease;}.ft-group input:focus,.ft-group select:focus{background:#fff;border-color:#15181d;box-shadow:3px 3px 0 #65e7ae;transform:translate(-1px,-1px);}#ft-date{color-scheme:light;cursor:pointer;}.ft-time-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}.ft-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px;}.ft-btns button{min-height:44px;padding:10px;border:2px solid #15181d;border-radius:12px;color:#15181d;font-family:"DM Sans",sans-serif;font-weight:800;cursor:pointer;font-size:13px;box-shadow:3px 3px 0 #15181d;transition:transform .12s ease,box-shadow .12s ease;}.ft-btns button:hover{transform:translate(1px,1px);box-shadow:2px 2px 0 #15181d;}.ft-btns button:active{transform:translate(3px,3px);box-shadow:0 0 0 #15181d;}#ft-submit{background:#65e7ae;grid-column:span 2;}#ft-clear{background:#cbe9ff;}#ft-clear-orig{background:#bff5d8;}#ft-cancel{background:#f7f8f5;grid-column:span 2;}#ft-action-modal{display:none;position:fixed;inset:0;width:100%;height:100%;background:rgba(21,24,29,.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:1000000;justify-content:center;align-items:center;}#ft-action-content{background:#fffbe8;padding:22px;border-radius:20px;width:min(320px,calc(100vw - 30px));color:#15181d;border:2px solid #15181d;box-shadow:5px 5px 0 #15181d;text-align:center;box-sizing:border-box;}#ft-action-content h4{margin:0 0 15px;color:#15181d;font-family:"Space Grotesk",sans-serif;font-size:19px;font-weight:800;}.ft-action-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.ft-action-btns button{padding:10px;border:2px solid #15181d;border-radius:11px;font-weight:800;cursor:pointer;color:#15181d;box-shadow:3px 3px 0 #15181d;}#ft-edit-btn{background:#65e7ae;}#ft-del-btn{background:#cbe9ff;}#ft-action-close{background:#f7f8f5;margin-top:10px;width:100%;padding:10px;border:2px solid #15181d;border-radius:11px;color:#15181d;font-weight:800;cursor:pointer;box-shadow:3px 3px 0 #15181d;}.ft-admin-contacts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px;padding-top:18px;border-top:2px solid #15181d;}.ft-admin-box{background:#f7f8f5;border:1.8px solid #15181d;border-radius:14px;padding:10px;text-align:center;box-shadow:3px 3px 0 #15181d;}.ft-admin-btn{display:block;padding:7px 4px;border:1.5px solid #15181d;border-radius:9px;font-size:11px;font-weight:800;text-decoration:none;color:#15181d;margin-bottom:5px;}.ft-tg-btn{background:#cbe9ff;}.ft-wa-btn{background:#bff5d8;}.ft-admin-val{font-size:10px;color:#66706b;word-break:break-all;}.ft-status-row{display:flex;align-items:center;justify-content:flex-start;gap:2px;}.custom-fake-txn{cursor:pointer;}#fake-txn-content::-webkit-scrollbar{width:6px;}#fake-txn-content::-webkit-scrollbar-thumb{background:#15181d;border-radius:20px;}@media(max-width:600px){#fake-txn-modal{align-items:flex-end;}#fake-txn-content{width:100%;max-width:none;max-height:86vh;padding:20px;border-radius:22px 22px 0 0;border-bottom:0;box-shadow:0 -4px 0 #15181d;}#ft-action-modal{align-items:flex-end;}#ft-action-content{width:100%;max-width:none;border-radius:20px 20px 0 0;border-bottom:0;box-shadow:0 -4px 0 #15181d;}}`;
    document.head.appendChild(s);
  }
  const gO = (m, s) => {
    let o = "";
    for (let i = 0; i <= m; i++) {
      let v = String(i).padStart(2, "0");
      o += `<option value="${v}" ${v === String(s).padStart(2, "0") ? "selected" : ""}>${v}</option>`;
    }
    return o;
  };
  const sDV = (d = null) => {
    let n = new Date(),
      y = n.getFullYear(),
      mo = String(n.getMonth() + 1).padStart(2, "0"),
      da = String(n.getDate()).padStart(2, "0"),
      h = n.getHours(),
      mi = n.getMinutes(),
      se = n.getSeconds();
    if (d && d.customDate) {
      try {
        let p = d.customDate.split(", "),
          dp = p[0].split("/"),
          tp = p[1].split(":");
        y = dp[2];
        mo = dp[1];
        da = dp[0];
        h = tp[0];
        mi = tp[1];
        se = tp[2];
      } catch (e) {}
    }
    document.getElementById("ft-date").value = `${y}-${mo}-${da}`;
    document.getElementById("ft-hour").innerHTML = gO(23, h);
    document.getElementById("ft-min").innerHTML = gO(59, mi);
    document.getElementById("ft-sec").innerHTML = gO(59, se);
    if (d) {
      document.getElementById("ft-type").value = d.type || "Deposit";
      document.getElementById("ft-amount").value = d.rawAmount || "18.00";
      document.getElementById("ft-method").value = d.method || "Easypaisa";
      document.getElementById("ft-status").value = d.status || "Successed";
    }
  };
  if (!document.getElementById("fake-txn-modal")) {
    let d = document.createElement("div");
    d.innerHTML = `<div id="fake-txn-modal"><div id="fake-txn-content"><h3><span>Transaction Panel</span></h3><div class="ft-subtitle">Transaction Editor by BNDA CoDex</div><input type="hidden" id="ft-edit-id" value=""><div class="ft-group"><label>Type</label><select id="ft-type"><option value="Deposit">Deposit</option><option value="Payout">Payout</option></select></div><div class="ft-group"><label>Amount</label><input type="text" id="ft-amount" value="18.00"></div><div class="ft-group"><label>Method</label><select id="ft-method"><option value="Easypaisa">Easypaisa</option><option value="USDT (TRC-20)">USDT (TRC-20)</option><option value="USDT (BEP-20)">USDT (BEP-20)</option><option value="Jazzcash">Jazzcash</option><option value="Binance Pay">Binance Pay</option></select></div><div class="ft-group"><label>Status</label><select id="ft-status"><option value="Successed">Successed</option><option value="Failed">Failed</option><option value="Processing">Processing</option><option value="Waiting confirmation">Waiting confirmation</option><option value="Waiting confirmation 5m">Waiting confirmation 5m</option></select></div><div class="ft-group"><label>Select Date (Calendar)</label><input type="date" id="ft-date"></div><div class="ft-group"><label>Select Time (Hours : Minutes : Seconds)</label><div class="ft-time-row"><select id="ft-hour"></select><select id="ft-min"></select><select id="ft-sec"></select></div></div><div class="ft-btns"><button id="ft-submit">Save / Generate</button><button id="ft-clear">Clear Fake</button><button id="ft-clear-orig">Clear Original</button><button id="ft-cancel">Close</button></div><div class="ft-admin-contacts"><div class="ft-admin-box"><a href="https://t.me/bnda_Codex" target="_blank" class="ft-admin-btn ft-tg-btn">Telegram</a><div class="ft-admin-val">@bnda_Codex</div></div><div class="ft-admin-box"><a href="https://wa.me/923306363018" target="_blank" class="ft-admin-btn ft-wa-btn">WhatsApp</div><div class="ft-admin-val">03306363018</div></div></div></div><div id="ft-action-modal"><div id="ft-action-content"><h4>Manage Transaction</h4><div class="ft-action-btns"><button id="ft-edit-btn">Edit</button><button id="ft-del-btn">Delete</button></div><button id="ft-action-close">Cancel</button></div></div>`;
    document.body.appendChild(d);
  }
  const m = document.getElementById("fake-txn-modal"),
    aM = document.getElementById("ft-action-modal");
  let sTD = null;
  document.getElementById("ft-cancel").onclick = () => {
    m.style.display = "none";
  };
  document.getElementById("ft-action-close").onclick = () => {
    aM.style.display = "none";
  };
  document.getElementById("ft-clear").onclick = () => {
    localStorage.removeItem("saved_fake_txns");
    document.querySelectorAll(".vDMA1.custom-fake-txn").forEach((t) => t.remove());
    m.style.display = "none";
  };
  document.getElementById("ft-clear-orig").onclick = () => {
    document.querySelectorAll(".vDMA1:not(.custom-fake-txn)").forEach((t) => t.remove());
    m.style.display = "none";
  };
  const cTD = (d) => {
    let nTD = document.createElement("div");
    nTD.className = "vDMA1 custom-fake-txn";
    nTD.dataset.txid = d.randomTxId;
    let aCS = d.type === "Payout" ? "color: #FF6251 !important;" : "color: #0FAF59 !important;",
      sC = "";
    if (d.status === "Successed") {
      sC = `<div class="Aa1Ox"><div class="UC4rf pS6eh"><svg class="icon-check-tiny"><use xlink:href="/profile/images/spritemap.svg#icon-check-tiny"></use></svg></div><span class="VgSqu uTLcj" style="color: #0FAF59 !important;">Successed</span></div>`;
    } else if (d.status === "Failed") {
      sC = `<div class="Aa1Ox"><div class="UC4rf pS6eh"><svg class="icon-check-tiny"><use xlink:href="/profile/images/spritemap.svg#icon-check-tiny"></use></svg></div><span class="VgSqu uTLcj" style="color: #FF6251 !important;">Failed</span></div>`;
    } else if (d.status === "Processing") {
      sC = `<div class="ft-status-row"><div class="Aa1Ox"><div class="UC4rf Jzzm9"><svg class="icon-pending"><use xlink:href="/profile/images/spritemap.svg#icon-pending"></use></svg></div><span class="VgSqu undefined">Processing</span></div><a href="javascript:void(0);" class="qvShE custom-cancel-btn">Cancel</a></div><div class="cxjSx">Please note that payments with this method could take up to 24 hours to get processed. If it's not on your balance by that time - please submit a support ticket. The status may appear as «Failed» until the funds are actually received on our side.</div>`;
    } else if (d.status === "Waiting confirmation" || d.status === "Waiting confirmation 5m") {
      sC = `<div class="ft-status-row"><div class="Aa1Ox"><div class="UC4rf Jzzm9"><svg class="icon-pending"><use xlink:href="/profile/images/spritemap.svg#icon-pending"></use></svg></div><span class="VgSqu undefined">Waiting confirmation</span></div><a href="javascript:void(0);" class="qvShE custom-cancel-btn">Cancel</a></div><div class="cxjSx">The withdrawal is currently being processed on the side of the financial operator. Please wait - the funds should be received within 48 hours.</div>`;
    }
    nTD.innerHTML = `<div class="VZvOf">${d.randomTxId}</div><div class="Sf_Tx">${d.customDate}</div><div class="_2NHFf">${sC}</div><div class="Ed7UM">${d.type}</div><div class="R1N82">${d.method}</div><div class="vKozV"><b class="lekbj QdPVe" style="${aCS}">${d.formattedAmount}</b></div>`;
    nTD.addEventListener("dblclick", () => {
      sTD = d;
      aM.style.display = "flex";
    });
    return nTD;
  };
  document.getElementById("ft-edit-btn").onclick = () => {
    aM.style.display = "none";
    if (sTD) {
      document.getElementById("ft-edit-id").value = sTD.randomTxId;
      sDV(sTD);
      m.style.display = "flex";
    }
  };
  document.getElementById("ft-del-btn").onclick = () => {
    aM.style.display = "none";
    if (sTD) {
      let sD = JSON.parse(localStorage.getItem("saved_fake_txns") || "[]");
      sD = sD.filter((i) => i.randomTxId !== sTD.randomTxId);
      localStorage.setItem("saved_fake_txns", JSON.stringify(sD));
      document.querySelectorAll(".custom-fake-txn").forEach((el) => {
        if (el.dataset.txid == sTD.randomTxId) el.remove();
      });
    }
  };
  const iTP = (tE) => {
      let fT = document.querySelector(".vDMA1:not(.custom-fake-txn)"),
        pC = fT?.parentElement || document.querySelector(".vDMA1")?.parentElement;
      if (!pC) return;
      let lCT = pC.querySelector(".custom-fake-txn");
      if (lCT) {
        pC.insertBefore(tE, lCT);
      } else if (fT) {
        pC.insertBefore(tE, fT);
      } else {
        pC.prepend(tE);
      }
    },
    rST = () => {
      let pC = document.querySelector(".vDMA1")?.parentElement;
      if (!pC) return;
      let sD = JSON.parse(localStorage.getItem("saved_fake_txns") || "[]");
      sD.forEach((d) => {
        let ex = Array.from(pC.children).some((c) => c.dataset.txid == d.randomTxId);
        if (!ex) {
          let tE = cTD(d);
          iTP(tE);
        }
      });
    };
  document.getElementById("ft-submit").onclick = () => {
    let eI = document.getElementById("ft-edit-id").value,
      tp = document.getElementById("ft-type").value,
      rA = document.getElementById("ft-amount").value.trim(),
      me = document.getElementById("ft-method").value,
      st = document.getElementById("ft-status").value,
      dV = document.getElementById("ft-date").value,
      hV = document.getElementById("ft-hour").value,
      mV = document.getElementById("ft-min").value,
      sV = document.getElementById("ft-sec").value,
      cD = "";
    if (dV) {
      let p = dV.split("-");
      if (p.length === 3) {
        cD = `${p[2]}/${p[1]}/${p[0]}, ${hV}:${mV}:${sV}`;
      }
    }
    if (!cD) {
      let now = new Date();
      cD = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}, ${hV}:${mV}:${sV}`;
    }
    let fA = `${tp === "Deposit" ? "+" : "-"}$${rA}`,
      sD = JSON.parse(localStorage.getItem("saved_fake_txns") || "[]");
    if (eI) {
      let idx = sD.findIndex((i) => i.randomTxId == eI);
      if (idx !== -1) {
        sD[idx].type = tp;
        sD[idx].rawAmount = rA;
        sD[idx].method = me;
        sD[idx].status = st;
        sD[idx].customDate = cD;
        sD[idx].formattedAmount = fA;
      }
      localStorage.setItem("saved_fake_txns", JSON.stringify(sD));
      document.querySelectorAll(".custom-fake-txn").forEach((el) => {
        if (el.dataset.txid == eI) el.remove();
      });
      iTP(cTD(sD[idx]));
    } else {
      let rTI =
          tp === "Payout"
            ? Math.floor(10000000000 + Math.random() * 90000000000)
            : Math.floor(100000000 + Math.random() * 900000000),
        tD = { type: tp, rawAmount: rA, method: me, status: st, customDate: cD, formattedAmount: fA, randomTxId: rTI };
      sD.push(tD);
      localStorage.setItem("saved_fake_txns", JSON.stringify(sD));
      iTP(cTD(tD));
    }
    document.getElementById("ft-edit-id").value = "";
    m.style.display = "none";
  };
  new MutationObserver(() => {
    document.querySelectorAll("div").forEach((el) => {
      if (el.textContent.trim() === "Amount" && !el.dataset.bound) {
        el.dataset.bound = "true";
        el.style.cursor = "pointer";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          document.getElementById("ft-edit-id").value = "";
          sDV();
          m.style.display = "flex";
        });
      }
    });
    rST();
  }).observe(document.body, { childList: true, subtree: true });
})();

// Activation System
document.addEventListener("DOMContentLoaded",()=>{

const btn=document.getElementById("activateBtn");

if(btn){
btn.onclick=()=>{

let email=document.getElementById("emailInput").value;

if(email.trim()==""){
alert("Enter Registered Email");
return;
}

// activation success
localStorage.setItem("activated","true");

alert("Access Activated Successfully");

};

}

});
