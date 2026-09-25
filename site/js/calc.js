(function (root) {
  function t(key, vars) {
    return root.I18N ? root.I18N.t(key, vars) : key;
  }

  const ACTIVITY = {
    sedentary: { k: 1.2, label: "Сидячий: офис, почти без тренировок" },
    light: { k: 1.375, label: "Лёгкая: 1–3 тренировки в неделю" },
    gym3: { k: 1.5, label: "Умеренная: зал 3–4 раза в неделю" },
    high: { k: 1.725, label: "Высокая: 6–7 тяжёлых тренировок" },
    extra: { k: 1.9, label: "Экстра: физическая работа или 2× в день" },
  };

  const LEVEL = {
    novice: { label: "Новичок" },
    active: { label: "Активный" },
    advanced: { label: "Продвинутый" },
    restart: { label: "После перерыва" },
    rehab: { label: "Ограничения / травмы" },
  };

  const STRATEGY = {
    gentle: { label: "Мягко", loseKg: 0.3, gainKg: 0.2 },
    optimal: { label: "Оптимально", loseKg: 0.41, gainKg: 0.3 },
    fast: { label: "Быстрее", loseKg: 0.65, gainKg: 0.4 },
  };

  const GOAL = {
    recomp: { label: "Рекомпозиция", verb: "рекомпозиция" },
    lose: { label: "Похудение", verb: "похудение" },
    gain: { label: "Набор массы", verb: "набор" },
    maintain: { label: "Поддержание", verb: "поддержание" },
  };

  const BEER_KCAL_PER_ML = 0.42;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function round10(n) {
    return Math.round(n / 10) * 10;
  }

  function round5(n) {
    return Math.round(n / 5) * 5;
  }

  function bmrMifflin({ sex, kg, cm, age }) {
    const base = 10 * kg + 6.25 * cm - 5 * age;
    return base + (sex === "female" ? -161 : 5);
  }

  function bmi({ kg, cm }) {
    const m = cm / 100;
    return kg / (m * m);
  }

  function alcoholKcal(input) {
    if (input.lifestyle !== "bali") return 0;
    if (input.alcohol === "custom") return Math.max(0, Number(input.alcoholKcal) || 0);
    const ml = { none: 0, beer330: 330, beer1000: 1000, beer1500: 1500 }[input.alcohol] || 0;
    return ml * BEER_KCAL_PER_ML;
  }

  function kgDelta(input) {
    if (input.goal === "maintain" || input.goal === "recomp") return 0;
    return Math.max(0, Number(input.kgDelta) || 0);
  }

  function pickDelta(tdee, input) {
    const strat = STRATEGY[input.strategy] || STRATEGY.optimal;
    if (input.goal === "maintain") return 0;
    if (input.goal === "recomp") {
      const mild = input.strategy === "fast" ? 0.12 : input.strategy === "gentle" ? 0.07 : 0.1;
      return Math.min(300, Math.round(tdee * mild));
    }
    if (input.goal === "gain") {
      const surplus = Math.round((strat.gainKg * 7700) / 7);
      return -clamp(surplus, 150, Math.round(tdee * 0.15));
    }
    const deficit = Math.round((strat.loseKg * 7700) / 7);
    return clamp(deficit, 250, Math.round(tdee * 0.22));
  }

  function macros({ kg, foodKcal, goal, alcoholKcal, level }) {
    let proteinPerKg = goal === "maintain" ? 1.6 : goal === "gain" ? 1.7 : goal === "recomp" ? 1.8 : 1.9;
    if (level === "advanced" && goal === "lose") proteinPerKg = 2.0;
    if (level === "novice") proteinPerKg = Math.min(proteinPerKg, 1.8);
    let proteinG = round5(kg * proteinPerKg);
    const fatPerKg = alcoholKcal >= 400 ? 0.7 : goal === "gain" ? 0.9 : 0.8;
    let fatG = round5(kg * fatPerKg);
    let proteinKcal = proteinG * 4;
    let fatKcal = fatG * 9;
    let carbKcal = foodKcal - proteinKcal - fatKcal;
    if (carbKcal < 80 * 4) {
      fatG = round5(Math.max(kg * 0.6, (foodKcal - proteinKcal - 320) / 9));
      fatKcal = fatG * 9;
      carbKcal = foodKcal - proteinKcal - fatKcal;
    }
    let carbG = Math.max(0, round5(carbKcal / 4));
    if (Math.abs(proteinG * 4 + fatG * 9 + carbG * 4 - foodKcal) >= 40) {
      carbG = Math.max(0, round5((foodKcal - proteinG * 4 - fatG * 9) / 4));
    }
    return {
      proteinG,
      fatG,
      carbG,
      proteinKcal: proteinG * 4,
      fatKcal: fatG * 9,
      carbKcal: carbG * 4,
    };
  }

  function recommendProduct(input) {
    const kg = kgDelta(input);
    if (input.level === "rehab" || input.level === "novice") return "custom-both";
    if (kg >= 8 || input.strategy === "fast") return "coach-both";
    return "coach-review";
  }

  function compute(input) {
    const kg = Number(input.kg);
    const cm = Number(input.cm);
    const age = Number(input.age);
    const deltaKg = kgDelta(input);
    if (!(kg > 0 && cm > 0 && age > 0)) return null;

    const bmrRaw = bmrMifflin({ sex: input.sex, kg, cm, age });
    const bmr = round10(bmrRaw);
    const activity = ACTIVITY[input.activity] || ACTIVITY.gym3;
    const tdee = round10(bmrRaw * activity.k);
    const delta = pickDelta(tdee, input);
    const target = Math.max(round10(tdee - delta), bmr);
    const drinkKcal = round10(alcoholKcal(input));
    const foodKcal = Math.max(round10(target - drinkKcal), round10(bmr * 0.8));
    const m = macros({
      kg,
      foodKcal,
      goal: input.goal,
      alcoholKcal: drinkKcal,
      level: input.level,
    });
    const dailyShift = Math.abs(delta);
    const weeks =
      dailyShift > 0 && deltaKg > 0 ? Math.round((deltaKg * 7700) / dailyShift / 7 * 10) / 10 : 0;
    const pace = dailyShift > 0 ? Math.round((dailyShift * 7) / 7700 * 100) / 100 : 0;
    const strat = STRATEGY[input.strategy] || STRATEGY.optimal;
    const level = LEVEL[input.level] || LEVEL.active;
    const goalMeta = GOAL[input.goal] || GOAL.recomp;

    return {
      kg,
      cm,
      age,
      sex: input.sex,
      goal: input.goal,
      goalLabel: t("goal." + (input.goal || "recomp")),
      lifestyle: input.lifestyle,
      activityKey: input.activity,
      activityLabel: t("act." + ((ACTIVITY[input.activity] && input.activity) || "gym3")),
      level: input.level,
      levelLabel: t("level." + ((LEVEL[input.level] && input.level) || "active")),
      strategy: input.strategy,
      strategyLabel: t("strategy." + ((STRATEGY[input.strategy] && input.strategy) || "optimal")),
      limits: (input.limits || "").trim(),
      kgDelta: deltaKg,
      bmi: Math.round(bmi({ kg, cm }) * 10) / 10,
      bmr,
      tdee,
      deficit: Math.max(0, delta),
      surplus: Math.max(0, -delta),
      target,
      drinkKcal,
      foodKcal,
      weeks,
      pace,
      recommend: recommendProduct(input),
      ...m,
    };
  }

  const QUERY_KEYS = [
    "sex",
    "age",
    "cm",
    "kg",
    "activity",
    "goal",
    "kgDelta",
    "alcohol",
    "alcoholKcal",
    "lifestyle",
    "level",
    "strategy",
    "limits",
  ];

  function toQuery(input) {
    const params = new URLSearchParams();
    QUERY_KEYS.forEach((key) => {
      if (input[key] !== undefined && input[key] !== "") params.set(key, String(input[key]));
    });
    return params.toString();
  }

  function fromQuery(search) {
    const params = new URLSearchParams(search);
    const defaults = {
      sex: "male",
      age: "35",
      cm: "175",
      kg: "80",
      activity: "gym3",
      goal: "recomp",
      kgDelta: "5",
      alcohol: "none",
      alcoholKcal: "",
      lifestyle: "usual",
      level: "active",
      strategy: "optimal",
      limits: "",
    };
    QUERY_KEYS.forEach((key) => {
      if (params.has(key)) defaults[key] = params.get(key);
    });
    return defaults;
  }

  function telegramText(input, result, productId) {
    const name = root.MITY && root.MITY.productName
      ? root.MITY.productName(productId)
      : productId;
    const sex = t(input.sex === "female" ? "tg.sex.f" : "tg.sex.m");
    let goal = result.goalLabel;
    if (input.goal === "lose" && result.kgDelta) goal += ", −" + result.kgDelta + " kg";
    if (input.goal === "gain" && result.kgDelta) goal += ", +" + result.kgDelta + " kg";
    const drink = result.drinkKcal
      ? t("tg.drink.yes", { n: result.drinkKcal })
      : input.lifestyle === "bali"
        ? t("tg.drink.bali0")
        : t("tg.drink.no");
    const lines = [
      t("tg.want", { name: name }),
      t("tg.body", { sex: sex, age: input.age, cm: input.cm, kg: input.kg }),
      t("tg.goal", { goal: goal, strategy: result.strategyLabel }),
      t("tg.level", { level: result.levelLabel }),
      t("tg.act", { activity: result.activityLabel }),
      t("tg.kcal", { bmr: result.bmr, tdee: result.tdee, target: result.target }),
      t("tg.food", { food: result.foodKcal, drink: drink }),
      t("tg.macros", { p: result.proteinG, f: result.fatG, c: result.carbG }),
    ];
    if (result.limits) lines.push(t("tg.limits", { n: result.limits }));
    return lines.join("\n");
  }

  root.MityCalc = {
    ACTIVITY,
    LEVEL,
    STRATEGY,
    GOAL,
    compute,
    toQuery,
    fromQuery,
    telegramText,
    round10,
  };
})(window);
