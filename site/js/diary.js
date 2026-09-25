(function () {
  const STORAGE = "mity-diary-v1";
  const CALC = "mity-calc-v2";

  const METRICS = [
    { id: "sleep", color: "#3b82f6" },
    { id: "energy", color: "#ef4444" },
    { id: "productivity", color: "#f59e0b" },
    { id: "wellbeing", color: "#fb923c" },
    { id: "satisfaction", color: "#a855f7" },
    { id: "activity", color: "#dc2626" },
    { id: "mood", color: "#ec4899" },
    { id: "stress", color: "#06b6d4", invert: true },
  ];

  const byId = Object.fromEntries(METRICS.map((m) => [m.id, m]));
  const FONT = "ui-sans-serif, system-ui, sans-serif";
  const TREND = ["sleep", "energy", "mood", "stress"];
  const INFLUENCE_TARGETS = ["productivity", "mood", "energy", "wellbeing", "satisfaction"];
  let influenceTarget = "productivity";
  let periodDays = 14;
  let plateKcal = 0;
  let plateAdds = [];
  let openFood = -1;

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function addDays(iso, n) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function metricLabel(id) {
    return I18N.t("metric." + id);
  }
  function metricShort(id) {
    return I18N.t("metricShort." + id);
  }

  function fmt(n) {
    return I18N.num(Math.round(n * 100) / 100, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function fmt1(n) {
    return I18N.num(Math.round(n * 10) / 10, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  function fmtInt(n) {
    return I18N.num(Math.round(n), { maximumFractionDigits: 0 });
  }

  function fmtDelta(n, invert) {
    const x = Math.round(n * 10) / 10;
    const abs = fmt1(Math.abs(x));
    if (Math.abs(x) < 0.05) return { text: "0", cls: "flat" };
    const better = invert ? x < 0 : x > 0;
    return {
      text: (x > 0 ? "+" : "−") + abs,
      cls: better ? "up" : "down",
    };
  }

  function statusOf(row) {
    return row.trainStatus || (row.train ? "done" : "rest");
  }

  function foodHitOf(row) {
    return row.foodHit || (row.food ? "on" : "under");
  }

  function proteinOk(row) {
    return row.proteinHit === true || row.proteinHit === "yes";
  }

  function numField(row, key) {
    const n = Number(row[key]);
    return n > 0 ? n : null;
  }

  function slicePeriod(rows, days, offsetDays) {
    const end = addDays(todayISO(), -(offsetDays || 0));
    const start = addDays(end, -(days - 1));
    return rows.filter((r) => r.date >= start && r.date <= end);
  }

  function calcResult() {
    let input = null;
    try {
      input = JSON.parse(localStorage.getItem(CALC) || "null");
    } catch (e) {}
    if (!input && location.search) input = MityCalc.fromQuery(location.search);
    return input && window.MityCalc ? MityCalc.compute(input) : null;
  }

  function setHtml(id, html) {
    const node = el(id);
    if (node) node.innerHTML = html;
  }

  function setText(id, text) {
    const node = el(id);
    if (node) node.textContent = text || "";
  }

  function kpiCard(value, label, delta) {
    const extra = delta
      ? "<small class=\"" + delta.cls + "\">" + delta.text + " " + I18N.t("an.vsPrev") + "</small>"
      : "";
    return (
      "<div class=\"dash-kpi\"><b>" +
      value +
      "</b><span>" +
      label +
      "</span>" +
      extra +
      "</div>"
    );
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, n) => s + n, 0) / arr.length;
  }

  function pearson(xs, ys) {
    const n = xs.length;
    if (n < 5) return null;
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      const a = xs[i] - mx;
      const b = ys[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    const den = Math.sqrt(dx * dy);
    if (!den) return 0;
    return num / den;
  }

  function demoEntries() {
    const end = todayISO();
    const out = [];
    for (let i = 20; i >= 0; i--) {
      const date = addDays(end, -i);
      const wave = Math.sin(i / 3.2);
      const dow = new Date(date + "T12:00:00").getDay();
      const train = dow !== 0 && dow !== 6;
      const sleep = clamp(6.2 + wave * 1.4 + (train ? 0.2 : -0.6), 2, 9);
      const activity = clamp((train ? 7.1 : 4.4) + wave * 0.8, 2, 9);
      const energy = clamp(0.45 * sleep + 0.4 * activity + 0.7 + wave * 0.3, 2, 9);
      const productivity = clamp(0.5 * sleep + 0.25 * energy + 1.4, 2, 9);
      const mood = clamp(0.4 * sleep + 0.35 * energy + 1.1 - (i === 4 ? 1.5 : 0), 2, 9);
      const wellbeing = clamp(0.35 * sleep + 0.3 * mood + 0.2 * activity + 1.2, 2, 9);
      const satisfaction = clamp(0.4 * activity + 0.3 * wellbeing + 1.3, 2, 9);
      const stress = clamp(7.2 - 0.45 * sleep - 0.2 * activity + (i % 5 === 1 ? 1.2 : 0), 2, 8);
      const round1 = (n) => Math.round(n);
      out.push({
        date,
        demo: true,
        train,
        trainStatus: train ? "done" : dow === 0 ? "rest" : "skipped",
        session: train ? ["a", "b", "c"][i % 3] : "a",
        effort: train ? (i % 4 === 0 ? "hard" : "ok") : "ok",
        trainNote: "",
        food: i % 5 !== 2,
        foodHit: i % 5 === 2 ? "over" : i % 5 === 4 ? "under" : "on",
        proteinHit: i % 5 !== 2,
        kcal: i % 5 === 2 ? 2780 : i % 5 === 4 ? 1680 : 2180 + (i % 3) * 40,
        proteinG: i % 5 === 2 ? 90 : i % 5 === 4 ? 95 : 140 + (i % 3) * 5,
        kg: i % 7 === 0 ? String(Math.round((80.4 - (20 - i) * 0.05) * 10) / 10) : "",
        foodNote: "",
        notes: "",
        scores: {
          sleep: round1(sleep),
          energy: round1(energy),
          productivity: round1(productivity),
          wellbeing: round1(wellbeing),
          satisfaction: round1(satisfaction),
          activity: round1(activity),
          mood: round1(mood),
          stress: round1(stress),
        },
      });
    }
    return out;
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (raw && Array.isArray(raw.entries) && raw.entries.length) {
        if (raw.demo || raw.entries.every((e) => e.demo)) {
          return { entries: demoEntries(), demo: true };
        }
        return raw;
      }
    } catch (e) {}
    return { entries: demoEntries(), demo: true };
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
    } catch (e) {}
  }

  let state = load();

  const CORE = ["sleep", "energy", "mood", "stress"];
  const MORE = ["productivity", "wellbeing", "satisfaction", "activity"];
  const form = document.getElementById("day-form");
  const scoreCore = document.getElementById("score-core");
  const scoreMore = document.getElementById("score-more");
  const isDiary = Boolean(form);
  const isAnalytics = document.documentElement.getAttribute("data-page") === "analytics";

  function el(id) {
    return document.getElementById(id);
  }
  function on(id, event, fn) {
    const node = el(id);
    if (node) node.addEventListener(event, fn);
  }

  function buildScoreBlock(root, ids, current) {
    if (!root) return;
    root.innerHTML = ids
      .map((id) => {
        const selected = Number(current[id] || (id === "stress" ? 4 : 6));
        const buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          .map(
            (n) =>
              `<button type="button" data-metric="${id}" data-value="${n}" aria-pressed="${n === selected ? "true" : "false"}">${n}</button>`
          )
          .join("");
        return `<div class="score-row"><span>${metricLabel(id)}</span><div class="seg score-seg">${buttons}</div></div>`;
      })
      .join("");
  }

  function buildScoreFields(keep) {
    const current = keep || {};
    buildScoreBlock(scoreCore, CORE, current);
    buildScoreBlock(scoreMore, MORE, current);
  }

  function readScore(id) {
    if (!form) return id === "stress" ? 4 : 6;
    const pressed = form.querySelector(`[data-metric="${id}"][aria-pressed="true"]`);
    return pressed ? Number(pressed.dataset.value) : id === "stress" ? 4 : 6;
  }

  function currentScores() {
    const scores = {};
    METRICS.forEach((m) => {
      scores[m.id] = readScore(m.id);
    });
    return scores;
  }

  function readNamed(name) {
    if (!form) return "";
    const root = form.querySelector(`.seg[data-name="${name}"]`);
    const pressed = root && root.querySelector('[aria-pressed="true"]');
    return pressed ? pressed.dataset.value : "";
  }

  function setNamed(name, value) {
    if (!form) return;
    const root = form.querySelector(`.seg[data-name="${name}"]`);
    if (!root) return;
    const next = value || root.querySelector("button").dataset.value;
    root.querySelectorAll("button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.value === next));
    });
  }

  function syncTrainDetails() {
    const details = el("train-details");
    if (details) details.classList.toggle("hidden", readNamed("trainStatus") !== "done");
  }

  function formatDayLabel(iso) {
    if (iso === todayISO()) return I18N.t("diary.dayToday");
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(I18N.locale(), { weekday: "short", day: "numeric", month: "short" });
  }

  function updateDayLabel() {
    const label = el("day-label");
    if (label && form) label.textContent = formatDayLabel(form.date.value);
  }

  function setScores(scores) {
    if (!form) return;
    METRICS.forEach((m) => {
      const v = String((scores && scores[m.id]) || (m.id === "stress" ? 4 : 6));
      form.querySelectorAll(`[data-metric="${m.id}"]`).forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.value === v));
      });
    });
  }

  function fillForm(entry) {
    if (!form) return;
    if (!entry) {
      setNamed("trainStatus", "done");
      setNamed("session", "a");
      setNamed("effort", "ok");
      setNamed("foodHit", "on");
      setNamed("proteinHit", "yes");
      form.trainNote.value = "";
      form.foodNote.value = "";
      form.kcal.value = "";
      form.proteinG.value = "";
      if (form.kg) form.kg.value = "";
      setScores({});
      syncTrainDetails();
      updateDayLabel();
      return;
    }
    setNamed("trainStatus", entry.trainStatus || (entry.train ? "done" : "rest"));
    setNamed("session", entry.session || "a");
    setNamed("effort", entry.effort || "ok");
    setNamed("foodHit", entry.foodHit || (entry.food ? "on" : "under"));
    setNamed("proteinHit", entry.proteinHit === false || entry.proteinHit === "no" ? "no" : "yes");
    form.trainNote.value = entry.trainNote || "";
    form.foodNote.value = entry.foodNote || entry.notes || "";
    form.kcal.value = entry.kcal || "";
    form.proteinG.value = entry.proteinG || "";
    if (form.kg) form.kg.value = entry.kg || "";
    setScores(entry.scores || {});
    syncTrainDetails();
    updateDayLabel();
  }

  function loadDate(iso) {
    if (!form) return;
    form.date.value = iso;
    fillForm(state.entries.find((e) => e.date === iso));
    plateKcal = 0;
    plateAdds = [];
    openFood = -1;
    paintPlate();
    paintFoodResults();
  }

  if (isDiary) {
    buildScoreFields();
    form.date.value = todayISO();
    form.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn || btn.type === "submit") return;
      const seg = btn.closest(".seg");
      if (!seg) return;
      if (btn.dataset.metric) {
        const id = btn.dataset.metric;
        form.querySelectorAll(`[data-metric="${id}"]`).forEach((b) => {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        return;
      }
      if (!seg.dataset.name) return;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      if (seg.dataset.name === "trainStatus") syncTrainDetails();
    });
  }

  function sorted() {
    return state.entries.slice().sort((a, b) => a.date.localeCompare(b.date));
  }

  function shortDate(iso) {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(I18N.locale(), { day: "numeric", month: "short" });
  }

  function svgEl(name, attrs, html) {
    const ns = "http://www.w3.org/2000/svg";
    const el = document.createElementNS(ns, name);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    if (html) el.textContent = html;
    return el;
  }

  function axisText(x, y, label, extra) {
    const attrs = Object.assign(
      {
        x: x,
        y: y,
        fill: "#57534e",
        "font-size": "13",
        "font-family": FONT,
      },
      extra || {}
    );
    return svgEl("text", attrs, label);
  }

  function yScore(pad, h, y) {
    return pad.t + (1 - (y - 1) / 9) * (h - pad.t - pad.b);
  }

  function drawScoreGrid(svg, pad, w, h, xAt, xTicks) {
    for (let y = 1; y <= 10; y++) {
      const yy = yScore(pad, h, y);
      svg.appendChild(
        svgEl("line", {
          x1: pad.l,
          x2: w - pad.r,
          y1: yy,
          y2: yy,
          stroke: y === 1 ? "#a8a29e" : "#ede7dc",
          "stroke-width": y === 1 || y === 10 ? "1.2" : "1",
        })
      );
      svg.appendChild(axisText(pad.l - 6, yy + 4, String(y), { "text-anchor": "end" }));
    }
    xTicks.forEach((tick, i) => {
      const xx = xAt(tick.v);
      svg.appendChild(
        svgEl("line", {
          x1: xx,
          x2: xx,
          y1: pad.t,
          y2: h - pad.b,
          stroke: i === 0 ? "#a8a29e" : "#ede7dc",
        })
      );
      if (tick.label) {
        svg.appendChild(axisText(xx, h - pad.b + 16, tick.label, { "text-anchor": "middle" }));
      }
    });
  }

  function relationChart(series) {
    const w = 640;
    const h = 280;
    const pad = { l: 36, r: 14, t: 12, b: 36 };
    const xAt = (x) => pad.l + ((x - 1) / 9) * (w - pad.l - pad.r);
    const svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, class: "chart-svg" });
    const ticks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ v: n, label: String(n) }));
    drawScoreGrid(svg, pad, w, h, xAt, ticks);
    series.forEach((s) => {
      const pts = s.points.slice().sort((a, b) => a.x - b.x);
      if (pts.length < 2) return;
      const d = pts.map((p, i) => (i ? "L" : "M") + xAt(p.x) + "," + yScore(pad, h, p.y)).join(" ");
      svg.appendChild(
        svgEl("path", {
          d: d,
          fill: "none",
          stroke: s.color,
          "stroke-width": "2.6",
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
      pts.forEach((p) =>
        svg.appendChild(svgEl("circle", { cx: xAt(p.x), cy: yScore(pad, h, p.y), r: 3.5, fill: s.color }))
      );
    });
    return svg;
  }

  function timeLines(rows, keys) {
    const w = 640;
    const h = 280;
    const pad = { l: 36, r: 14, t: 12, b: 36 };
    const n = Math.max(rows.length, 2);
    const xAt = (i) => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
    const svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, class: "chart-svg" });
    const step = rows.length > 16 ? 3 : rows.length > 10 ? 2 : 1;
    const ticks = [];
    for (let i = 0; i < rows.length; i += step) {
      const show =
        i === 0 || i === rows.length - 1 || i === Math.round((rows.length - 1) / 2);
      ticks.push({ v: i, label: show && rows[i] ? shortDate(rows[i].date) : "" });
    }
    if (rows.length && ticks[ticks.length - 1].v !== rows.length - 1) {
      ticks.push({ v: rows.length - 1, label: shortDate(rows[rows.length - 1].date) });
    }
    drawScoreGrid(svg, pad, w, h, xAt, ticks);
    keys.forEach((key) => {
      const color = byId[key].color;
      const d = rows
        .map((row, i) => (i ? "L" : "M") + xAt(i) + "," + yScore(pad, h, row.scores[key]))
        .join(" ");
      svg.appendChild(
        svgEl("path", {
          d: d,
          fill: "none",
          stroke: color,
          "stroke-width": "2.4",
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
    });
    return svg;
  }

  function valueLine(points, color) {
    const w = 640;
    const h = 220;
    const pad = { l: 44, r: 14, t: 12, b: 36 };
    const ys = points.map((p) => p.y);
    let minY = Math.min.apply(null, ys);
    let maxY = Math.max.apply(null, ys);
    if (maxY === minY) {
      minY -= 0.5;
      maxY += 0.5;
    } else {
      minY -= 0.2;
      maxY += 0.2;
    }
    const n = Math.max(points.length, 2);
    const xAt = (i) => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
    const yAt = (y) => pad.t + (1 - (y - minY) / (maxY - minY)) * (h - pad.t - pad.b);
    const svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, class: "chart-svg" });
    const yTicks = [minY, (minY + maxY) / 2, maxY];
    yTicks.forEach((y) => {
      const yy = yAt(y);
      svg.appendChild(
        svgEl("line", {
          x1: pad.l,
          x2: w - pad.r,
          y1: yy,
          y2: yy,
          stroke: "#ede7dc",
        })
      );
      svg.appendChild(axisText(pad.l - 6, yy + 4, fmt1(y), { "text-anchor": "end" }));
    });
    points.forEach((p, i) => {
      if (!p.date) return;
      const show = i === 0 || i === points.length - 1;
      if (show) svg.appendChild(axisText(xAt(i), h - pad.b + 16, shortDate(p.date), { "text-anchor": "middle" }));
    });
    const d = points.map((p, i) => (i ? "L" : "M") + xAt(i) + "," + yAt(p.y)).join(" ");
    svg.appendChild(
      svgEl("path", {
        d: d,
        fill: "none",
        stroke: color,
        "stroke-width": "2.4",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      })
    );
    points.forEach((p, i) =>
      svg.appendChild(svgEl("circle", { cx: xAt(i), cy: yAt(p.y), r: 3.5, fill: color }))
    );
    return svg;
  }

  function influenceChart(items) {
    const w = 640;
    const rowH = 42;
    const pad = { l: 158, r: 58, t: 10, b: 36 };
    const h = pad.t + pad.b + Math.max(items.length, 1) * rowH;
    const xAt = (r) => pad.l + ((r + 1) / 2) * (w - pad.l - pad.r);
    const svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, class: "chart-svg" });
    [-1, -0.5, 0, 0.5, 1].forEach((r) => {
      svg.appendChild(
        svgEl("line", {
          x1: xAt(r),
          x2: xAt(r),
          y1: pad.t,
          y2: h - pad.b,
          stroke: r === 0 ? "#042f2e" : "#ede7dc",
          "stroke-width": r === 0 ? "1.4" : "1",
        })
      );
      const label = I18N.num(r, {
        minimumFractionDigits: r % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
      });
      svg.appendChild(axisText(xAt(r), h - pad.b + 16, label, { "text-anchor": "middle" }));
    });
    items.forEach((item, i) => {
      const cy = pad.t + i * rowH + rowH / 2;
      svg.appendChild(axisText(pad.l - 10, cy + 4, item.label, { "text-anchor": "end" }));
      const x0 = xAt(0);
      const x1 = xAt(item.r);
      svg.appendChild(
        svgEl("line", {
          x1: x0,
          x2: x1,
          y1: cy,
          y2: cy,
          stroke: item.r >= 0 ? "#0f766e" : "#c2410c",
          "stroke-width": "10",
          "stroke-linecap": "round",
        })
      );
      svg.appendChild(
        axisText(item.r >= 0 ? x1 + 8 : x1 - 8, cy + 4, fmt(item.r), {
          "text-anchor": item.r >= 0 ? "start" : "end",
          fill: "#1c1917",
          "font-weight": "700",
        })
      );
    });
    return svg;
  }

  function betterFor(id) {
    if (id === "sleep" || id === "energy" || id === "mood" || id === "wellbeing" || id === "productivity") {
      return I18N.t("better.sleep");
    }
    if (id === "activity" || id === "satisfaction") return I18N.t("better.train");
    if (id === "stress") return I18N.t("better.lessStress");
    return I18N.t("better.move");
  }

  function buildInfluenceTargets() {
    const root = el("influence-target");
    if (!root) return;
    root.innerHTML = INFLUENCE_TARGETS.map((id) => {
      return (
        "<button type=\"button\" data-target=\"" +
        id +
        "\" aria-pressed=\"" +
        (id === influenceTarget ? "true" : "false") +
        "\">" +
        metricLabel(id) +
        "</button>"
      );
    }).join("");
    const label = document.getElementById("influence-label");
    if (label) label.textContent = metricLabel(influenceTarget);
  }

  function render() {
    const rows = sorted();
    const demo = state.demo || rows.every((r) => r.demo);
    const demoBanner = el("demo-banner");
    if (demoBanner) demoBanner.classList.toggle("hidden", !demo);

    if (isAnalytics) {
      renderAnalytics(rows);
    }

    const log = el("log-cards");
    if (!log) return;
    log.innerHTML = rows
      .slice()
      .reverse()
      .map((row) => {
        const status = row.trainStatus || (row.train ? "done" : "rest");
        const trainText =
          status === "done"
            ? I18N.t("log.trainDone", { session: I18N.t("train." + (row.session || "a")) })
            : status === "skipped"
              ? I18N.t("log.trainSkip")
              : I18N.t("log.trainRest");
        const hit = row.foodHit || (row.food ? "on" : "under");
        const foodKey = hit === "over" ? "log.foodOver" : hit === "under" ? "log.foodUnder" : "log.foodOn";
        const meta = I18N.t("log.cardMeta", { train: trainText, food: I18N.t(foodKey) });
        const scores = I18N.t("diary.scoresLine", {
          sleep: row.scores.sleep,
          energy: row.scores.energy,
          stress: row.scores.stress,
        });
        const when = formatDayLabel(row.date);
        return (
          "<article class=\"log-day\" data-date=\"" +
          row.date +
          "\"><b>" +
          when +
          "</b><p>" +
          meta +
          "</p><p>" +
          scores +
          "</p><button type=\"button\" class=\"linkish\" data-edit=\"" +
          row.date +
          "\">" +
          I18N.t("diary.open") +
          "</button></article>"
        );
      })
      .join("");
  }

  function renderAnalytics(allRows) {
    const cur = slicePeriod(allRows, periodDays, 0);
    const prev = slicePeriod(allRows, periodDays, periodDays);
    const calc = calcResult();
    const expected = Math.max(1, Math.round((periodDays / 7) * 3));

    const periodRoot = el("period-range");
    if (periodRoot) {
      periodRoot.innerHTML = [7, 14, 28]
        .map((d) => {
          return (
            "<button type=\"button\" data-period=\"" +
            d +
            "\" aria-pressed=\"" +
            (d === periodDays ? "true" : "false") +
            "\">" +
            I18N.t("an.d" + d) +
            "</button>"
          );
        })
        .join("");
    }

    const sleepNow = mean(cur.map((r) => r.scores.sleep));
    const sleepPrev = prev.length ? mean(prev.map((r) => r.scores.sleep)) : null;
    const skipsNow = cur.filter((r) => statusOf(r) === "skipped").length;
    const skipsPrev = prev.filter((r) => statusOf(r) === "skipped").length;
    const foodOnNow = cur.filter((r) => foodHitOf(r) === "on").length;
    const foodOnPrev = prev.filter((r) => foodHitOf(r) === "on").length;
    const doneNow = cur.filter((r) => statusOf(r) === "done").length;
    const restNow = cur.filter((r) => statusOf(r) === "rest").length;
    const proteinNow = cur.filter(proteinOk).length;

    const sleepDelta = sleepPrev != null && prev.length ? fmtDelta(sleepNow - sleepPrev) : null;
    const skipDelta = prev.length ? fmtDelta(skipsNow - skipsPrev, true) : null;
    const foodPctNow = cur.length ? (100 * foodOnNow) / cur.length : 0;
    const foodPctPrev = prev.length ? (100 * foodOnPrev) / prev.length : 0;
    const foodDelta = prev.length ? fmtDelta(foodPctNow - foodPctPrev) : null;
    if (foodDelta && foodDelta.text !== "0") foodDelta.text += "%";

    const verdictBits = [];
    if (sleepPrev != null && sleepNow - sleepPrev >= 0.4) verdictBits.push(I18N.t("an.vSleepUp"));
    else if (sleepPrev != null && sleepNow - sleepPrev <= -0.4) verdictBits.push(I18N.t("an.vSleepDown"));
    if (doneNow < expected - 1) verdictBits.push(I18N.t("an.vTrainLow", { n: doneNow, exp: expected }));
    else if (doneNow >= expected) verdictBits.push(I18N.t("an.vTrainOk", { n: doneNow, exp: expected }));
    if (cur.length && foodPctNow < 50) verdictBits.push(I18N.t("an.vFoodLow"));
    else if (cur.length && foodPctNow >= 70) verdictBits.push(I18N.t("an.vFoodOk"));
    setText("week-verdict", verdictBits.length ? verdictBits.join(" ") : I18N.t("an.vSteady"));

    const lagPairs = [];
    const byDate = Object.fromEntries(cur.map((r) => [r.date, r]));
    cur.forEach((row) => {
      const next = byDate[addDays(row.date, 1)];
      if (next) lagPairs.push({ x: row.scores.sleep, y: next.scores.energy });
    });
    let action = I18N.t("an.actHold");
    if (skipsNow >= 2 && doneNow < expected) action = I18N.t("an.actSkip");
    else if (cur.length && proteinNow / cur.length < 0.5) action = I18N.t("an.actProtein");
    else if (sleepPrev != null && sleepNow - sleepPrev <= -0.4) action = I18N.t("an.actSleep");
    setText("week-action", cur.length ? action : "");

    setHtml(
      "week-kpis",
      kpiCard(fmt1(sleepNow || 0), I18N.t("an.sleep"), sleepDelta) +
        kpiCard(String(skipsNow), I18N.t("an.skips"), skipDelta) +
        kpiCard(
          I18N.t("an.of", { a: foodOnNow, b: cur.length || 0 }),
          I18N.t("an.foodOn"),
          foodDelta
        )
    );
    setText("week-range", cur.length ? I18N.t("diary.days", { n: cur.length }) : "");

    const abc = { a: 0, b: 0, c: 0 };
    let hard = 0;
    cur.forEach((r) => {
      if (statusOf(r) !== "done") return;
      abc[r.session || "a"] = (abc[r.session || "a"] || 0) + 1;
      if (r.effort === "hard") hard += 1;
    });
    setHtml(
      "train-kpis",
      kpiCard(String(doneNow), I18N.t("an.done")) +
        kpiCard(String(skipsNow), I18N.t("an.skip")) +
        kpiCard(String(restNow), I18N.t("an.rest"))
    );
    setText("train-abc", I18N.t("an.abc", { a: abc.a || 0, b: abc.b || 0, c: abc.c || 0 }) + " · " + I18N.t("an.expected", { n: expected }));
    setText("train-hard", doneNow ? I18N.t("an.hard", { n: hard, done: doneNow }) : "");

    if (calc) {
      setText("food-goal", I18N.t("an.foodHint", { kcal: calc.foodKcal, p: calc.proteinG }));
    } else {
      setText("food-goal", I18N.t("an.foodNoCalc"));
    }
    const kcals = cur.map((r) => numField(r, "kcal")).filter((n) => n != null);
    const kcalAvg = kcals.length ? mean(kcals) : null;
    const kcalLabel =
      kcalAvg != null && calc
        ? I18N.t("an.kcalVs", { avg: fmtInt(kcalAvg), goal: calc.foodKcal })
        : kcalAvg != null
          ? fmtInt(kcalAvg)
          : "—";
    setHtml(
      "food-kpis",
      kpiCard(I18N.t("an.of", { a: foodOnNow, b: cur.length || 0 }), I18N.t("an.foodOn")) +
        kpiCard(I18N.t("an.of", { a: proteinNow, b: cur.length || 0 }), I18N.t("an.proteinHit")) +
        kpiCard(kcalLabel, I18N.t("an.kcalAvg"))
    );

    const trainDays = cur.filter((r) => statusOf(r) === "done");
    const skipDays = cur.filter((r) => statusOf(r) === "skipped");
    const splitRoot = el("split-grid");
    if (splitRoot) {
      if (trainDays.length && skipDays.length) {
        const cell = (title, list) => {
          const sl = mean(list.map((r) => r.scores.sleep));
          const en = mean(list.map((r) => r.scores.energy));
          const mo = mean(list.map((r) => r.scores.mood));
          return (
            "<div class=\"compare-cell\"><h4>" +
            title +
            "</h4><p>" +
            I18N.t("an.sleep") +
            " <b>" +
            fmt1(sl) +
            "</b></p><p>" +
            I18N.t("metricShort.energy") +
            " <b>" +
            fmt1(en) +
            "</b></p><p>" +
            I18N.t("metricShort.mood") +
            " <b>" +
            fmt1(mo) +
            "</b></p></div>"
          );
        };
        splitRoot.innerHTML =
          cell(I18N.t("an.trainDays", { n: trainDays.length }), trainDays) +
          cell(I18N.t("an.skipDays", { n: skipDays.length }), skipDays);
      } else {
        splitRoot.innerHTML = "<p class=\"muted\">" + I18N.t("an.needSplit") + "</p>";
      }
    }

    const lagRoot = el("lag-chart");
    if (lagRoot) {
      lagRoot.innerHTML = "";
      const lagGrouped = {};
      lagPairs.forEach((p) => {
        if (!lagGrouped[p.x]) lagGrouped[p.x] = [];
        lagGrouped[p.x].push(p.y);
      });
      const lagPts = Object.keys(lagGrouped)
        .map(Number)
        .sort((a, b) => a - b)
        .map((x) => ({ x: x, y: mean(lagGrouped[x]) }));
      const highSleep = lagPairs.filter((p) => p.x >= 7);
      const lowSleep = lagPairs.filter((p) => p.x <= 5);
      if (lagPts.length >= 2) {
        lagRoot.appendChild(relationChart([{ color: byId.energy.color, points: lagPts }]));
        setHtml(
          "lag-legend",
          "<i style=\"background:" + byId.energy.color + "\"></i>" + I18N.t("an.lagLegend")
        );
        if (highSleep.length >= 2 && lowSleep.length >= 2) {
          setText(
            "lag-note",
            I18N.t("an.lagLine", {
              high: "≥ 7",
              eHigh: fmt1(mean(highSleep.map((p) => p.y))),
              low: "≤ 5",
              eLow: fmt1(mean(lowSleep.map((p) => p.y))),
            })
          );
        } else {
          setText("lag-note", "");
        }
      } else {
        setText("lag-legend", "");
        setText("lag-note", I18N.t("an.lagNeed"));
      }
    }

    const scored = cur
      .map((row) => ({
        row: row,
        s: row.scores.sleep + row.scores.energy + row.scores.mood - row.scores.stress,
      }))
      .sort((a, b) => b.s - a.s);
    const extremeLine = (item) => {
      const row = item.row;
      const st = statusOf(row);
      const trainText =
        st === "done"
          ? I18N.t("log.trainDone", { session: I18N.t("train." + (row.session || "a")) })
          : st === "skipped"
            ? I18N.t("log.trainSkip")
            : I18N.t("log.trainRest");
      const hit = foodHitOf(row);
      const foodKey = hit === "over" ? "log.foodOver" : hit === "under" ? "log.foodUnder" : "log.foodOn";
      return (
        "<p class=\"extreme-row\"><b>" +
        formatDayLabel(row.date) +
        "</b>" +
        trainText +
        " · " +
        I18N.t(foodKey) +
        " · " +
        I18N.t("an.sleep") +
        " " +
        row.scores.sleep +
        "</p>"
      );
    };
    const best = scored.slice(0, Math.min(2, scored.length));
    const worst = scored.slice(-Math.min(2, scored.length)).reverse();
    setHtml(
      "extremes",
      cur.length
        ? "<div class=\"extremes-col\"><h4>" +
            I18N.t("an.best") +
            "</h4>" +
            best.map(extremeLine).join("") +
            "</div><div class=\"extremes-col\"><h4>" +
            I18N.t("an.worst") +
            "</h4>" +
            worst.map(extremeLine).join("") +
            "</div>"
        : ""
    );

    const weightPts = cur
      .map((r) => ({ date: r.date, y: numField(r, "kg") }))
      .filter((p) => p.y != null);
    const weightPanel = el("weight-panel");
    if (weightPanel) {
      const show = weightPts.length >= 2;
      weightPanel.classList.toggle("hidden", !show);
      if (show) {
        const hint = [I18N.t("an.weightHint")];
        if (calc) hint.push(I18N.t("an.weightStart", { kg: calc.kg }));
        setText("weight-hint", hint.join(" "));
        const wRoot = el("weight-chart");
        wRoot.innerHTML = "";
        wRoot.appendChild(valueLine(weightPts, "#0f766e"));
        const delta = weightPts[weightPts.length - 1].y - weightPts[0].y;
        const signed = (delta > 0 ? "+" : "") + fmt1(delta);
        setText("weight-pace", I18N.t("an.pace", { delta: signed }));
      }
    }

    const stack = el("stack-chart");
    if (stack) {
      stack.innerHTML = "";
      if (cur.length) stack.appendChild(timeLines(cur, TREND));
    }
    const stackLegend = el("stack-legend");
    if (stackLegend) {
      stackLegend.innerHTML = TREND.map((id) => {
        return "<i style=\"background:" + byId[id].color + "\"></i>" + metricShort(id);
      }).join("");
    }

    buildInfluenceTargets();
    const influenceRows = cur.length >= 10 ? cur : [];
    const targetRows = influenceRows.map((r) => r.scores[influenceTarget]);
    const influenceItems = METRICS.filter((m) => m.id !== influenceTarget)
      .map((m) => {
        const r = pearson(
          influenceRows.map((row) => row.scores[m.id]),
          targetRows
        );
        if (r === null || Math.abs(r) < 0.3) return null;
        return { id: m.id, r: r, label: metricShort(m.id) };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const infRoot = el("influence-chart");
    if (infRoot) {
      infRoot.innerHTML = "";
      if (influenceItems.length) infRoot.appendChild(influenceChart(influenceItems));
    }
    const insight = el("insight");
    if (insight) {
      if (!influenceItems.length) {
        insight.textContent = I18N.t("diary.needDays");
      } else {
        insight.textContent = I18N.t("an.influenceAct", {
          a: metricShort(influenceItems[0].id),
          better: betterFor(influenceItems[0].id),
        });
      }
    }
  }

  function paintFoodTarget() {
    const node = el("food-target");
    if (!node) return;
    let input = null;
    try {
      input = JSON.parse(localStorage.getItem(CALC) || "null");
    } catch (e) {}
    if (!input && location.search) input = MityCalc.fromQuery(location.search);
    const result = input && window.MityCalc ? MityCalc.compute(input) : null;
    node.textContent = result
      ? I18N.t("food.target", { kcal: result.foodKcal, p: result.proteinG })
      : I18N.t("food.noTarget");
  }

  const FOODS = window.MityFoods || [];
  let foodCat = "all";

  function foodName(item) {
    return I18N.lang() === "en" ? item.en : item.ru;
  }

  function foodMacros(item) {
    return I18N.t("food.macros", { p: item.p || 0, f: item.f || 0, c: item.c || 0 });
  }

  function addedCount(index) {
    return plateAdds.filter((i) => i === index).length;
  }

  function paintFoodCats() {
    const catsRoot = el("food-cats");
    if (!catsRoot) return;
    const cats = ["all", "protein", "carb", "bali", "drink"];
    catsRoot.innerHTML = cats
      .map((id) => {
        return (
          "<button type=\"button\" data-food-cat=\"" +
          id +
          "\" aria-pressed=\"" +
          (id === foodCat ? "true" : "false") +
          "\">" +
          I18N.t("food.cat." + id) +
          "</button>"
        );
      })
      .join("");
  }

  function paintPlate() {
    const node = el("food-plate");
    if (!node) return;
    node.textContent = plateKcal ? I18N.t("food.plate", { n: plateKcal }) : "";
  }

  function paintFoodResults() {
    const qNode = el("food-q");
    const root = el("food-results");
    if (!qNode || !root) return;
    const q = (qNode.value || "").trim().toLowerCase();
    let list = FOODS.filter((item) => foodCat === "all" || item.cat === foodCat);
    if (q) {
      list = list.filter((item) => {
        const blob = (item.ru + " " + item.en + " " + (item.tags || "")).toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }
    list = list.slice(0, 24);
    if (!list.length) {
      root.innerHTML = "<p class=\"muted\">" + I18N.t("food.empty") + "</p>";
      return;
    }
    root.innerHTML = list
      .map((item) => {
        const idx = FOODS.indexOf(item);
        const unit = I18N.t("food.unit." + item.unit);
        const n = addedCount(idx);
        const open = idx === openFood;
        const addedLabel =
          n > 1 ? I18N.t("food.addedN", { n: n }) : n === 1 ? I18N.t("food.added") : "";
        const removeBtn = n
          ? "<button type=\"button\" class=\"btn ghost\" data-remove-food=\"" +
            idx +
            "\">" +
            I18N.t("food.remove") +
            "</button>"
          : "";
        return (
          "<div class=\"food-row" +
          (open ? " open" : "") +
          "\">" +
          "<button type=\"button\" class=\"food-peek\" data-peek-food=\"" +
          idx +
          "\"><b>" +
          foodName(item) +
          "</b><span>" +
          I18N.t("food.unitKcal", { n: item.kcal, unit: unit }) +
          "</span></button>" +
          "<div class=\"food-actions\">" +
          "<button type=\"button\" class=\"btn ghost\" data-add-food=\"" +
          idx +
          "\" aria-expanded=\"" +
          String(open) +
          "\">" +
          I18N.t("food.add") +
          "</button>" +
          removeBtn +
          "</div>" +
          "<p class=\"food-macros\">" +
          foodMacros(item) +
          (addedLabel ? " · " + addedLabel : "") +
          "</p></div>"
        );
      })
      .join("");
  }

  function addFood(index) {
    const item = FOODS[index];
    if (!item || !form) return;
    const kcal = Number(form.kcal.value) || 0;
    const p = Number(form.proteinG.value) || 0;
    form.kcal.value = String(kcal + item.kcal);
    form.proteinG.value = String(p + (item.p || 0));
    plateKcal += item.kcal;
    plateAdds.push(index);
    openFood = index;
    paintPlate();
    paintFoodResults();
  }

  function removeFood(index) {
    const item = FOODS[index];
    if (!item || !form) return;
    const at = plateAdds.lastIndexOf(index);
    if (at < 0) {
      openFood = openFood === index ? -1 : openFood;
      paintFoodResults();
      return;
    }
    plateAdds.splice(at, 1);
    const kcal = Number(form.kcal.value) || 0;
    const p = Number(form.proteinG.value) || 0;
    form.kcal.value = String(Math.max(0, kcal - item.kcal));
    form.proteinG.value = String(Math.max(0, p - (item.p || 0)));
    plateKcal = Math.max(0, plateKcal - item.kcal);
    if (!addedCount(index)) openFood = -1;
    else openFood = index;
    paintPlate();
    paintFoodResults();
  }

  function peekFood(index) {
    openFood = openFood === index ? -1 : index;
    paintFoodResults();
  }

  function saveAnalyticsPdf() {
    const rows = sorted();
    const brand = (window.MITY && MITY.brand) || "ProFitMITY";
    const title = el("print-title");
    if (title) {
      title.textContent = I18N.t("diary.printTitle", {
        brand: brand,
        n: rows.length,
      });
    }
    document.body.classList.add("print-analytics");
    const done = function () {
      document.body.classList.remove("print-analytics");
    };
    window.addEventListener("afterprint", done, { once: true });
    window.setTimeout(function () {
      window.print();
    }, 40);
  }

  function showTab(id) {
    if (id === "analytics") {
      location.href = "analytics.html" + (location.search || "");
      return;
    }
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.setAttribute("aria-selected", String(btn.dataset.tab === id));
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.panel !== id);
    });
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const date = form.date.value;
      const trainStatus = readNamed("trainStatus") || "done";
      const foodHit = readNamed("foodHit") || "on";
      const proteinHit = readNamed("proteinHit") !== "no";
      const entry = {
        date,
        demo: false,
        train: trainStatus === "done",
        trainStatus,
        session: readNamed("session") || "a",
        effort: readNamed("effort") || "ok",
        trainNote: form.trainNote.value.trim(),
        food: foodHit === "on",
        foodHit,
        proteinHit,
        kcal: form.kcal.value,
        proteinG: form.proteinG.value,
        kg: form.kg ? form.kg.value : "",
        foodNote: form.foodNote.value.trim(),
        notes: form.foodNote.value.trim(),
        scores: {},
      };
      METRICS.forEach((m) => {
        entry.scores[m.id] = readScore(m.id);
      });
      state.entries = state.entries.filter((e) => e.date !== date);
      if (state.demo) {
        state.entries = state.entries.filter((e) => !e.demo);
        state.demo = false;
      }
      state.entries.push(entry);
      save(state);
      render();
    });
  }

  on("clear-demo", "click", () => {
    state = { entries: [], demo: false };
    save(state);
    loadDate(todayISO());
    render();
  });

  on("log-cards", "click", (event) => {
    const btn = event.target.closest("[data-edit]");
    if (!btn) return;
    loadDate(btn.dataset.edit);
    showTab("today");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const tabs = document.querySelector(".diary-tabs");
  if (tabs) {
    tabs.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tab]");
      if (!btn) return;
      showTab(btn.dataset.tab);
    });
  }

  on("influence-target", "click", (event) => {
    const btn = event.target.closest("[data-target]");
    if (!btn) return;
    influenceTarget = btn.dataset.target;
    render();
  });

  on("period-range", "click", (event) => {
    const btn = event.target.closest("[data-period]");
    if (!btn) return;
    periodDays = Number(btn.dataset.period) || 14;
    render();
  });

  on("food-cats", "click", (event) => {
    const btn = event.target.closest("[data-food-cat]");
    if (!btn) return;
    foodCat = btn.dataset.foodCat;
    openFood = -1;
    paintFoodCats();
    paintFoodResults();
  });
  on("food-q", "input", () => {
    openFood = -1;
    paintFoodResults();
  });
  on("food-q", "keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  on("food-results", "click", (event) => {
    const remove = event.target.closest("[data-remove-food]");
    if (remove) {
      removeFood(Number(remove.dataset.removeFood));
      return;
    }
    const add = event.target.closest("[data-add-food]");
    if (add) {
      addFood(Number(add.dataset.addFood));
      return;
    }
    const peek = event.target.closest("[data-peek-food]");
    if (peek) peekFood(Number(peek.dataset.peekFood));
  });
  on("save-analytics", "click", saveAnalyticsPdf);

  on("day-prev", "click", () => {
    loadDate(addDays(form.date.value, -1));
  });
  on("day-next", "click", () => {
    const next = addDays(form.date.value, 1);
    if (next > todayISO()) return;
    loadDate(next);
  });
  if (form) {
    form.date.addEventListener("change", () => loadDate(form.date.value));
  }

  on("toggle-more", "click", (event) => {
    const more = el("score-more");
    more.classList.toggle("hidden");
    const open = !more.classList.contains("hidden");
    event.currentTarget.setAttribute("data-i18n", open ? "diary.lessScores" : "diary.moreScores");
    event.currentTarget.textContent = I18N.t(open ? "diary.lessScores" : "diary.moreScores");
  });

  try {
    const calc = JSON.parse(localStorage.getItem(CALC) || "null");
    const toPlan = el("to-plan");
    if (toPlan) {
      if (calc) {
        toPlan.href = "plan.html?" + MityCalc.toQuery(calc);
      } else if (location.search) {
        toPlan.href = "plan.html" + location.search;
      }
    }
  } catch (e) {}

  paintFoodTarget();
  paintFoodCats();
  paintFoodResults();
  if (isDiary) loadDate(todayISO());
  render();
  const hash = (location.hash || "").replace("#", "");
  if (hash === "analytics") {
    location.replace("analytics.html" + (location.search || ""));
  } else if (hash === "log") {
    showTab("log");
  }

  document.addEventListener("mity:lang", () => {
    if (isDiary) {
      buildScoreFields(currentScores());
      updateDayLabel();
    }
    paintFoodTarget();
    paintFoodCats();
    paintFoodResults();
    paintPlate();
    render();
  });
})();
