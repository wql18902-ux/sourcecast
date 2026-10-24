/* 知栈 · 判断库 —— 前端（零框架、零外链）
   数据来自 data.js 里的 window.LIB；收藏存 localStorage。 */
(() => {
  "use strict";

  const LIB = window.LIB || { episodes: [], series: [] };
  const EPS = LIB.episodes.slice();
  const SAVE_KEY = "zhizhan.saved.v1";
  const THEME_KEY = "zhizhan.theme";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // 一条判断 = { text, ep }
  const ALL = [];
  EPS.forEach((ep) => ep.judgments.forEach((t, i) => ALL.push({ text: t, ep, i })));

  const state = {
    q: "",
    series: "",
    saved: new Set(load(SAVE_KEY, [])),
  };

  /* ── 小工具 ─────────────────────────────────────── */
  function load(k, d) {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }
    catch { return d; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式忽略 */ }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function mark(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const words = q.split(/\s+/).filter((w) => w.length > 0)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!words.length) return safe;
    try {
      return safe.replace(new RegExp(`(${words.join("|")})`, "gi"), "<mark>$1</mark>");
    } catch { return safe; }
  }
  function epLabel(ep) { return `ep${ep.no}`; }
  function epShort(ep) {
    const t = ep.title || ep.slug;
    return t.length > 22 ? t.slice(0, 21) + "…" : t;
  }
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 1900);
  }

  /* ── 判断库 ─────────────────────────────────────── */
  function matchJ(j, q) {
    if (!q) return true;
    const hay = `${j.text} ${epShort(j.ep)} ${j.ep.series}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w.toLowerCase()));
  }

  function renderFilters() {
    const host = $("#seriesFilters");
    const counts = {};
    EPS.forEach((ep) => { counts[ep.series] = (counts[ep.series] || 0) + 1; });
    const items = [["", "全部"]].concat(Object.keys(counts).map((s) => [s, s]));
    host.innerHTML = items.map(([k, label]) => {
      const n = k ? counts[k] : EPS.length;
      return `<button class="chip ${state.series === k ? "is-on" : ""}" data-series="${esc(k)}">${esc(label)}<span class="n">${n}</span></button>`;
    }).join("");
    $$(".chip", host).forEach((b) => b.addEventListener("click", () => {
      state.series = b.dataset.series;
      renderFilters(); renderJudgments(); renderEpisodes();
    }));
  }

  function renderJudgments() {
    const host = $("#jgrid");
    const list = ALL.filter((j) => (!state.series || j.ep.series === state.series) && matchJ(j, state.q));
    $("#resultCount").textContent = `${list.length} 条`;
    $("#jempty").hidden = list.length > 0;
    host.innerHTML = list.map((j) => {
      const id = `${j.ep.slug}#${j.i}`;
      const on = state.saved.has(id);
      return `<article class="jcard" data-ep="${esc(j.ep.slug)}">
        <p class="jcard__text">${mark(j.text, state.q)}</p>
        <div class="jcard__foot">
          <button class="jcard__ep" data-open="${esc(j.ep.slug)}">${epLabel(j.ep)}</button>
          <span class="jcard__series">${esc(j.ep.series || "—")}</span>
          <button class="save ${on ? "is-on" : ""}" data-save="${esc(id)}" aria-pressed="${on}" aria-label="收进我的清单">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 2.5h8v11l-4-2.6-4 2.6z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            </svg>
            ${on ? "已收" : "收藏"}
          </button>
        </div>
      </article>`;
    }).join("");
    $$("[data-open]", host).forEach((b) => b.addEventListener("click", () => openEp(b.dataset.open)));
    $$("[data-save]", host).forEach((b) => b.addEventListener("click", () => toggleSave(b.dataset.save)));
  }

  /* ── 收藏 ───────────────────────────────────────── */
  function toggleSave(id) {
    if (state.saved.has(id)) { state.saved.delete(id); toast("已从清单移除"); }
    else { state.saved.add(id); toast("已收进清单 · 右上角书签查看"); }
    save(SAVE_KEY, Array.from(state.saved));
    syncSaved();
  }
  function savedEntries() {
    return Array.from(state.saved).map((id) => {
      const [slug, idx] = id.split("#");
      const ep = EPS.find((e) => e.slug === slug);
      const text = ep && ep.judgments[Number(idx)];
      return text ? { id, text, ep } : null;
    }).filter(Boolean);
  }
  function syncSaved() {
    $("#savedCount").textContent = String(state.saved.size);
    $$("[data-save]").forEach((b) => {
      const on = state.saved.has(b.dataset.save);
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
      b.lastChild.textContent = on ? " 已收" : " 收藏";
    });
    if ($("#mydrawer").classList.contains("is-open")) renderSaved();
  }
  function renderSaved() {
    const rows = savedEntries();
    const body = $("#myBody");
    if (!rows.length) {
      body.innerHTML = `<div class="empty">清单还是空的。<br>在判断库里点 <b>收藏</b>，把要带走的那几句攒起来。</div>`;
      return;
    }
    body.innerHTML = `
      <p class="drawer__sub" style="margin-top:0">${rows.length} 条 · 存在这台设备的浏览器里，不上传任何地方。</p>
      <div class="mylist">${rows.map((r) => `
        <div class="myitem">
          <div>
            <div class="myitem__t">「${esc(r.text)}」</div>
            <div class="myitem__m">${epLabel(r.ep)} · ${esc(epShort(r.ep))} · ${esc(r.ep.series || "")}</div>
          </div>
          <button class="save is-on" data-rm="${esc(r.id)}" aria-label="移除">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
        </div>`).join("")}
      </div>
      <div class="exportbar">
        <button class="btn btn--primary" id="copyMd">复制 Markdown</button>
        <button class="btn btn--ghost" id="dlMd">下载 .md</button>
        <button class="btn btn--ghost" id="clearAll">清空</button>
      </div>`;
    $$("[data-rm]", body).forEach((b) => b.addEventListener("click", () => {
      state.saved.delete(b.dataset.rm); save(SAVE_KEY, Array.from(state.saved)); syncSaved(); renderSaved();
    }));
    $("#copyMd").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(toMarkdown(rows)); toast("已复制，可以直接粘到笔记里"); }
      catch { toast("这个浏览器不让写剪贴板，用「下载 .md」"); }
    });
    $("#dlMd").addEventListener("click", () => {
      const blob = new Blob([toMarkdown(rows)], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "我的判断清单.md";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast("已下载");
    });
    $("#clearAll").addEventListener("click", () => {
      state.saved.clear(); save(SAVE_KEY, []); syncSaved(); renderSaved(); toast("清单已清空");
    });
  }
  function toMarkdown(rows) {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return [
      "# 我的判断清单",
      "",
      `> 摘自《知栈 · 判断库》· 39 期 AI 技术播客 · 导出于 ${stamp}`,
      "",
      ...rows.map((r, i) => `${i + 1}. 「${r.text}」\n   —— ${epLabel(r.ep)} ${epShort(r.ep)}${r.ep.series ? " · " + r.ep.series : ""}`),
      "",
    ].join("\n");
  }

  /* ── 期次列表 ───────────────────────────────────── */
  function renderEpisodes() {
    const host = $("#eplist");
    const list = EPS.filter((ep) => !state.series || ep.series === state.series).slice().reverse();
    host.innerHTML = list.map((ep) => {
      const tags = [
        ep.audio ? `<span class="tag tag--audio">可试听</span>` : "",
        ep.judgments.length ? `<span class="tag tag--judge">${ep.judgments.length} 条判断</span>` : "",
        ep.series ? `<span class="tag">${esc(ep.series)}</span>` : "",
      ].join("");
      const desc = ep.one_liner || ep.subtitle || (ep.repos.length ? ep.repos.join(" · ") : "—");
      return `<button class="eprow" data-open="${esc(ep.slug)}">
        <span class="eprow__no">${String(ep.no).padStart(2, "0")}</span>
        <span class="eprow__main">
          <span class="eprow__t">${esc(ep.title || ep.slug)}<span class="date">${esc(ep.date || "")}</span></span>
          <span class="eprow__s">${esc(desc)}</span>
        </span>
        <span class="eprow__tags">${tags}</span>
        <span class="eprow__go" aria-hidden="true">→</span>
      </button>`;
    }).join("");
    $$("[data-open]", host).forEach((b) => b.addEventListener("click", () => openEp(b.dataset.open)));
  }

  /* ── 期次抽屉 ───────────────────────────────────── */
  let lastFocus = null;
  function openEp(slug) {
    const ep = EPS.find((e) => e.slug === slug);
    if (!ep) return;
    lastFocus = document.activeElement;
    $("#dNo").textContent = `EP ${String(ep.no).padStart(2, "0")}`;

    const audio = ep.audio
      ? `<div class="dhead">试听</div>
         <div class="player">
           <audio controls preload="metadata" src="media/ep${ep.no}-preview.m4a"></audio>
           <p class="player__cap">节选 96 秒，节选自 ${ep.audio.minutes} 分钟的整期；AI 合成语音（云端语音合成，含原主播前缀与背景音乐）。</p>
         </div>`
      : `<div class="dhead">试听</div>
         <p class="player__cap">这一期没有放试听。39 期里 23 期有成品音频，其中不含第三方音色的 8 期在本站开放片段。</p>`;

    const judges = ep.judgments.length
      ? `<div class="dhead">这一期能带走的判断</div>
         <div class="jlist">${ep.judgments.map((t, i) => `
            <div class="jitem">
              <span class="jitem__i">${String(i + 1).padStart(2, "0")}</span>
              <span class="jitem__t">${esc(t)}</span>
              <button class="save ${state.saved.has(`${ep.slug}#${i}`) ? "is-on" : ""}" data-save="${esc(ep.slug)}#${i}">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 2.5h8v11l-4-2.6-4 2.6z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>`).join("")}
         </div>`
      : `<div class="dhead">这一期能带走的判断</div>
         <p class="player__cap">这一期的页面里没有单独提炼判断——前十期记的是细节台账，判断是从第 20 期起才单独立成一节。</p>`;

    const repos = ep.repos.length
      ? `<div class="dhead">讲过的仓库</div><div class="ep-repos">${ep.repos.map((r) => `<span>${esc(r)}</span>`).join("")}</div>`
      : "";

    const rel = ep.related.length
      ? `<div class="dhead">相关期次</div><div class="rel">${ep.related.map((s) => {
          const t = EPS.find((e) => e.slug === s);
          return `<button data-goto="${esc(s)}">${t ? `${epLabel(t)} · ${esc(epShort(t))}` : esc(s)}</button>`;
        }).join("")}</div>`
      : "";

    $("#dBody").innerHTML = `
      <h2>${esc(ep.title || ep.slug)}</h2>
      ${ep.subtitle ? `<p class="drawer__sub">${esc(ep.subtitle)}</p>` : ""}
      <div class="drawer__meta">
        ${ep.date ? `<span class="tag">${esc(ep.date)}</span>` : ""}
        ${ep.series ? `<span class="tag">${esc(ep.series)}</span>` : ""}
        ${ep.question ? `<span class="tag">${esc(ep.question)}</span>` : ""}
      </div>
      ${ep.one_liner ? `<blockquote class="oneliner">${esc(ep.one_liner)}</blockquote>` : ""}
      ${audio}
      ${judges}
      ${repos}
      ${rel}
    `;
    $$("[data-save]", $("#dBody")).forEach((b) => b.addEventListener("click", () => toggleSave(b.dataset.save)));
    $$("[data-goto]", $("#dBody")).forEach((b) => b.addEventListener("click", () => openEp(b.dataset.goto)));
    showDrawer("#drawer");
  }

  /* ── 抽屉开关 ───────────────────────────────────── */
  function showDrawer(sel) {
    $("#scrim").classList.add("is-open");
    $(sel).classList.add("is-open");
    $(sel).setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function hideDrawers() {
    ["#drawer", "#mydrawer"].forEach((s) => { $(s).classList.remove("is-open"); $(s).setAttribute("aria-hidden", "true"); });
    $("#scrim").classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $("#scrim").addEventListener("click", hideDrawers);
  $("#dClose").addEventListener("click", hideDrawers);
  $("#myClose").addEventListener("click", hideDrawers);
  $("#openSaved").addEventListener("click", () => { renderSaved(); showDrawer("#mydrawer"); });

  /* ── 今日一条 / 随机 ─────────────────────────────── */
  function dailyPick() {
    if (!ALL.length) return null;
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return ALL[seed % ALL.length];
  }
  function renderDaily(j, animate) {
    const host = $("#daily");
    if (!j) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = `
      <span class="daily__tag">今日一条</span>
      <div>
        <p class="daily__q">${esc(j.text)}</p>
        <div class="daily__meta">
          <a href="#" data-open="${esc(j.ep.slug)}">${epLabel(j.ep)} · ${esc(epShort(j.ep))}</a>
          <span>${esc(j.ep.series || "")}</span>
          <span>${esc(j.ep.date || "")}</span>
        </div>
      </div>`;
    $(".daily__q", host).addEventListener("click", (e) => e.stopPropagation());
    $$("[data-open]", host).forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault(); openEp(b.dataset.open);
    }));
    if (animate) {
      const el = $(".daily__q", host);
      el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
        { duration: 340, easing: "cubic-bezier(.2,.7,.2,1)" });
    }
  }
  $("#rollBtn").addEventListener("click", () => {
    const j = ALL[Math.floor(Math.random() * ALL.length)];
    renderDaily(j, true);
    toast("换了一条 · 再抽一次试试");
  });

  /* ── 搜索 ───────────────────────────────────────── */
  const qEl = $("#q");
  let qt = null;
  qEl.addEventListener("input", () => {
    clearTimeout(qt);
    qt = setTimeout(() => {
      state.q = qEl.value.trim();
      renderJudgments();
    }, 110);
  });
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) { e.preventDefault(); qEl.focus(); qEl.select(); }
    if (e.key === "Escape") {
      if (typing) { qEl.blur(); }
      else if ($("#drawer").classList.contains("is-open") || $("#mydrawer").classList.contains("is-open")) hideDrawers();
    }
  });

  /* ── 主题 ───────────────────────────────────────── */
  const savedTheme = load(THEME_KEY, null) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day");
  document.documentElement.setAttribute("data-theme", savedTheme);
  $("#toggleTheme").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "night" ? "day" : "night";
    document.documentElement.setAttribute("data-theme", next);
    save(THEME_KEY, next);
  });

  /* ── 入场 / 导航高亮 ─────────────────────────────── */
  const io = new IntersectionObserver((rows) => {
    rows.forEach((r) => { if (r.isIntersecting) { r.target.classList.add("in"); io.unobserve(r.target); } });
  }, { rootMargin: "-40px 0px -10% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  const navLinks = $$(".nav a");
  const secs = ["judgments", "episodes", "pipeline", "about"].map((id) => document.getElementById(id));
  const navIo = new IntersectionObserver((rows) => {
    rows.forEach((r) => {
      if (!r.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.nav === r.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  secs.forEach((s) => s && navIo.observe(s));

  /* ── 初始化 ─────────────────────────────────────── */
  function init() {
    $("#sEp").innerHTML = `${LIB.count || EPS.length}<small>期</small>`;
    $("#sJ").innerHTML = `${LIB.judgment_count || ALL.length}<small>条</small>`;
    $("#sR").innerHTML = `${LIB.repo_count || 0}<small>个</small>`;
    $("#sA").innerHTML = `${LIB.audio_count || 0}<small>期</small>`;
    $("#dataDate").textContent = LIB.last_date || "—";
    $("#savedCount").textContent = String(state.saved.size);
    renderFilters();
    renderJudgments();
    renderEpisodes();
    renderDaily(dailyPick(), false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
