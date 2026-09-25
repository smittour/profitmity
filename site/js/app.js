(function () {
  const STORAGE = "mity-calc-v2";
  const form = document.getElementById("form");
  if (!form) return;

  const segs = [...form.querySelectorAll(".seg")];
  const customAlcohol = document.getElementById("alcohol-custom");
  const alcoholSeg = document.getElementById("alcohol-seg");
  const baliNote = document.getElementById("bali-note");
  const kgWrap = document.getElementById("kg-delta-wrap");
  const kgLabel = document.getElementById("kg-delta-label");
  const limitsWrap = document.getElementById("limits-wrap");
  const strategyWrap = document.getElementById("strategy-wrap");
  const results = document.getElementById("results");
  const alcoholRow = document.getElementById("alcohol-row");

  function readSeg(name) {
    const root = document.querySelector(`.seg[data-name="${name}"]`);
    const pressed = root && root.querySelector('[aria-pressed="true"]');
    return pressed ? pressed.dataset.value : "";
  }

  function setSeg(name, value) {
    const root = document.querySelector(`.seg[data-name="${name}"]`);
    if (!root) return;
    const match = [...root.querySelectorAll("button")].some((btn) => btn.dataset.value === value);
    if (!match) return;
    root.querySelectorAll("button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.value === value));
    });
  }

  function selectedProduct(family) {
    const root = document.querySelector(`.pack-seg[data-pack="${family}"]`);
    const pressed = root && root.querySelector('[aria-pressed="true"]');
    return pressed ? pressed.dataset.product : family + "-both";
  }

  function readInput() {
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      sex: readSeg("sex"),
      lifestyle: readSeg("lifestyle"),
      activity: readSeg("activity"),
      goal: readSeg("goal"),
      alcohol: readSeg("lifestyle") === "bali" ? readSeg("alcohol") : "none",
      level: readSeg("level"),
      strategy: readSeg("strategy"),
      age: data.age,
      cm: data.cm,
      kg: data.kg,
      kgDelta: data.kgDelta,
      alcoholKcal: data.alcoholKcal,
      limits: data.limits || "",
    };
  }

  function syncVisibility(input) {
    const showKg = input.goal === "lose" || input.goal === "gain";
    kgWrap.classList.toggle("hidden", !showKg);
    kgLabel.textContent = I18N.t(input.goal === "gain" ? "field.gainKg" : "field.loseKg");
    limitsWrap.classList.toggle("hidden", input.level !== "rehab");
    strategyWrap.classList.toggle("hidden", input.goal === "maintain");
    const bali = input.lifestyle === "bali";
    baliNote.classList.toggle("hidden", !bali);
    alcoholSeg.classList.toggle("hidden", !bali);
    customAlcohol.classList.toggle("hidden", !bali || input.alcohol !== "custom");
  }

  function applyInput(input) {
    setSeg("sex", input.sex);
    setSeg("lifestyle", input.lifestyle);
    setSeg("activity", input.activity);
    setSeg("goal", input.goal);
    setSeg("alcohol", input.alcohol || "none");
    setSeg("level", input.level || "active");
    setSeg("strategy", input.strategy || "optimal");
    form.age.value = input.age;
    form.cm.value = input.cm;
    form.kg.value = input.kg;
    form.kgDelta.value = input.kgDelta || "5";
    form.alcoholKcal.value = input.alcoholKcal || "";
    form.limits.value = input.limits || "";
    syncVisibility(input);
  }

  function telegramHref(input, result, productId) {
    const text = MityCalc.telegramText(input, result, productId);
    return `${MITY.telegram}?text=${encodeURIComponent(text)}`;
  }

  function syncPack(family, productId) {
    const card = document.querySelector(`.card[data-family="${family}"]`);
    if (!card) return;
    const product = MITY.products[productId];
    if (!product) return;
    const view = MITY.priceView(product);
    const slot = card.querySelector("[data-price-slot]");
    const pay = card.querySelector("[data-pay-slot]");
    const blurb = card.querySelector("[data-blurb-slot]");
    const buy = card.querySelector("a.buy");
    if (slot) slot.innerHTML = "<span>" + view.usd + "</span><span class=\"rub\">" + view.rub + "</span>";
    if (pay) pay.textContent = view.note;
    if (blurb) blurb.textContent = MITY.productBlurb(productId);
    if (buy) buy.dataset.product = productId;
  }

  function render(input, result) {
    if (!result) {
      results.classList.add("hidden");
      return;
    }
    const t = I18N.t.bind(I18N);
    const num = I18N.num.bind(I18N);
    results.classList.remove("hidden");
    document.getElementById("out-bmr").textContent = num(result.bmr);
    document.getElementById("out-tdee").textContent = num(result.tdee);
    document.getElementById("out-target").textContent = num(result.target);
    const weeksEl = document.getElementById("out-weeks");
    const weeksLabel = document.getElementById("out-weeks-label");
    if (result.goal === "maintain") {
      weeksEl.textContent = t("stat.weight");
      weeksLabel.textContent = t("stat.maintain");
    } else if (result.goal === "recomp") {
      weeksEl.textContent = result.strategyLabel;
      weeksLabel.textContent = t("stat.recomp", { n: result.deficit });
    } else if (result.goal === "gain") {
      weeksEl.textContent = result.weeks ? t("stat.weeksN", { n: num(result.weeks) }) : result.strategyLabel;
      weeksLabel.textContent = result.kgDelta
        ? t("stat.gainKg", { kg: result.kgDelta, n: result.surplus })
        : t("stat.surplus", { n: result.surplus });
    } else {
      weeksEl.textContent = result.weeks ? t("stat.weeksN", { n: num(result.weeks) }) : result.strategyLabel;
      weeksLabel.textContent = result.kgDelta
        ? t("stat.loseKg", { kg: result.kgDelta, n: result.deficit })
        : t("stat.deficit", { n: result.deficit });
    }

    document.getElementById("out-p").textContent = t("g", { n: result.proteinG });
    document.getElementById("out-f").textContent = t("g", { n: result.fatG });
    document.getElementById("out-c").textContent = t("g", { n: result.carbG });
    document.getElementById("out-pk").textContent = num(result.proteinKcal);
    document.getElementById("out-fk").textContent = num(result.fatKcal);
    document.getElementById("out-ck").textContent = num(result.carbKcal);
    document.getElementById("out-a").textContent = result.drinkKcal ? num(result.drinkKcal) : "0";
    alcoholRow.classList.toggle("hidden", !result.drinkKcal);
    document.getElementById("alcohol-row-label").textContent = t("nut.alcohol");

    const foodLine = result.drinkKcal
      ? t("proto.foodDrink", { target: num(result.target), food: num(result.foodKcal), drink: num(result.drinkKcal) })
      : t("proto.foodOnly", { target: num(result.target) });
    let paceLine = t("proto.base");
    if (result.goal === "lose" && result.deficit) {
      paceLine = t("proto.lose", { pace: num(result.pace, { maximumFractionDigits: 2 }) });
    } else if (result.goal === "gain" && result.surplus) {
      paceLine = t("proto.gain", { n: result.surplus });
    } else if (result.goal === "recomp") {
      paceLine = t("proto.recomp", { n: result.deficit });
    }
    const baliLine = result.lifestyle === "bali" ? t("proto.bali") : "";
    document.getElementById("out-protocol").textContent = foodLine + paceLine + baliLine;
    const rec = MITY.products[result.recommend];
    document.getElementById("out-bmi").textContent = t("bmi.line", {
      bmi: num(result.bmi, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      level: result.levelLabel,
      activity: result.activityLabel,
      pack: rec ? MITY.productName(result.recommend) : t("nav.packs"),
    });

    const q = MityCalc.toQuery(input);
    document.getElementById("open-plan").href = "plan.html?" + q;
    const diary = document.getElementById("open-diary");
    if (diary) diary.href = "diary.html?" + q;
    const analytics = document.getElementById("open-analytics");
    if (analytics) analytics.href = "analytics.html?" + q;
    document.getElementById("buy-rec").href = "#packs";
    document.getElementById("ask-tg").href = telegramHref(input, result, result.recommend);
    document.getElementById("bar-tg").href = telegramHref(input, result, result.recommend);

    const recFamily = rec ? rec.family : "self";
    document.querySelectorAll(".card").forEach((card) => {
      card.classList.toggle("featured", card.dataset.family === recFamily);
    });
    document.querySelectorAll("a.buy").forEach((a) => {
      const productId = selectedProduct(a.dataset.family);
      a.href = telegramHref(input, result, productId);
    });

    try {
      localStorage.setItem(STORAGE, JSON.stringify(input));
    } catch (e) {}
  }

  function recalc(scroll) {
    const input = readInput();
    syncVisibility(input);
    const result = MityCalc.compute(input);
    render(input, result);
    if (scroll && result) results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  segs.forEach((seg) => {
    seg.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      recalc(false);
    });
  });

  document.querySelectorAll(".pack-seg").forEach((seg) => {
    seg.addEventListener("click", (event) => {
      const btn = event.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      syncPack(seg.dataset.pack, btn.dataset.product);
      const input = readInput();
      const result = MityCalc.compute(input);
      const buy = document.querySelector(`a.buy[data-family="${seg.dataset.pack}"]`);
      if (buy && result) buy.href = telegramHref(input, result, btn.dataset.product);
    });
  });

  form.addEventListener("input", () => recalc(false));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    recalc(true);
  });
  document.getElementById("reset").addEventListener("click", () => {
    try { localStorage.removeItem(STORAGE); } catch (e) {}
    applyInput(MityCalc.fromQuery(""));
    recalc(false);
  });

  function saveAndOpenPlan() {
    const input = readInput();
    const result = MityCalc.compute(input);
    if (!result) {
      form.scrollIntoView({ behavior: "smooth" });
      return;
    }
    try { localStorage.setItem(STORAGE, JSON.stringify(input)); } catch (e) {}
    location.href = "plan.html?" + MityCalc.toQuery(input);
  }

  const openPlan = document.getElementById("open-plan");
  if (openPlan) {
    openPlan.addEventListener("click", (event) => {
      event.preventDefault();
      saveAndOpenPlan();
    });
  }

  document.querySelectorAll(".pack-seg").forEach((seg) => {
    const pressed = seg.querySelector('[aria-pressed="true"]');
    if (pressed) syncPack(seg.dataset.pack, pressed.dataset.product);
  });

  let start = MityCalc.fromQuery(location.search);
  if (!location.search) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (saved) start = saved;
    } catch (e) {}
  }
  applyInput(start);
  recalc(Boolean(location.search));

  document.querySelectorAll("a.buy").forEach((a) => {
    a.addEventListener("click", (event) => {
      const input = readInput();
      const result = MityCalc.compute(input);
      if (!result) {
        event.preventDefault();
        form.scrollIntoView({ behavior: "smooth" });
        return;
      }
      a.href = telegramHref(input, result, selectedProduct(a.dataset.family));
    });
  });

  document.addEventListener("mity:lang", () => {
    document.querySelectorAll(".pack-seg").forEach((seg) => {
      const pressed = seg.querySelector('[aria-pressed="true"]');
      if (pressed) syncPack(seg.dataset.pack, pressed.dataset.product);
    });
    recalc(false);
  });
})();
