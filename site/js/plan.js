(function () {
  const input = MityCalc.fromQuery(location.search);
  const computed = MityCalc.compute(input);
  if (!computed) {
    location.href = "index.html#calc";
    return;
  }

  const SPLIT = {
    ru: {
      novice: [["Пн", "Всё тело: присед / жим / тяга лёгкая"], ["Ср", "Всё тело, те же паттерны, чуть другой хват"], ["Пт", "Всё тело + кардио зона 2"]],
      active: [["Пн", "Грудь, трицепс, передняя дельта"], ["Ср", "Спина, бицепс, задняя дельта"], ["Пт", "Ноги и плечи"]],
      advanced: [["Пн", "Верх: жимовой акцент"], ["Ср", "Низ + кор"], ["Пт", "Верх: тяговый акцент"], ["Опц. сб", "Слабое место или зона 2 40 мин"]],
      restart: [["Пн", "Всё тело, вес на 2 шага легче привычного"], ["Ср", "Всё тело + зона 2"], ["Пт", "Всё тело, не гнать отказ"]],
      rehab: [["Пн", "Безболезненный паттерн + верх"], ["Ср", "Зона 2 + кор без компрессии"], ["Пт", "Нижняя часть в безопасной амплитуде"]],
    },
    en: {
      novice: [["Mon", "Full body: squat / press / light hinge"], ["Wed", "Full body, same patterns, different grip"], ["Fri", "Full body + zone 2 cardio"]],
      active: [["Mon", "Chest, triceps, front delts"], ["Wed", "Back, biceps, rear delts"], ["Fri", "Legs and shoulders"]],
      advanced: [["Mon", "Upper: press focus"], ["Wed", "Lower + core"], ["Fri", "Upper: pull focus"], ["Sat opt.", "Weak point or zone 2 40 min"]],
      restart: [["Mon", "Full body, two steps lighter than usual"], ["Wed", "Full body + zone 2"], ["Fri", "Full body, no grinding to failure"]],
      rehab: [["Mon", "Pain-free pattern + upper"], ["Wed", "Zone 2 + core without compression"], ["Fri", "Lower body in a safe range"]],
    },
  };

  function paint() {
    const result = MityCalc.compute(input);
    const t = I18N.t.bind(I18N);
    const num = I18N.num.bind(I18N);
    document.getElementById("out-bmr").textContent = num(result.bmr);
    document.getElementById("out-tdee").textContent = num(result.tdee);
    document.getElementById("out-target").textContent = num(result.target);
    document.getElementById("out-food").textContent = num(result.foodKcal);
    document.getElementById("out-p").textContent = t("g", { n: result.proteinG });
    document.getElementById("out-f").textContent = t("g", { n: result.fatG });
    document.getElementById("out-c").textContent = t("g", { n: result.carbG });
    document.getElementById("out-pk").textContent = num(result.proteinKcal);
    document.getElementById("out-fk").textContent = num(result.fatKcal);
    document.getElementById("out-ck").textContent = num(result.carbKcal);
    document.getElementById("out-a").textContent = result.drinkKcal ? num(result.drinkKcal) : "0";
    document.getElementById("alcohol-row").classList.toggle("hidden", !result.drinkKcal);

    const sex = t(input.sex === "female" ? "plan.sex.f" : "plan.sex.m");
    let goal = result.goalLabel;
    if (result.goal === "lose" && result.kgDelta) goal = t("plan.goalLose", { n: result.kgDelta });
    if (result.goal === "gain" && result.kgDelta) goal = t("plan.goalGain", { n: result.kgDelta });

    document.getElementById("headline").textContent = t("plan.headline", {
      cm: input.cm,
      kg: input.kg,
      goal: goal,
    });
    document.getElementById("sub").textContent = t("plan.sub", {
      sex: sex,
      age: input.age,
      bmi: num(result.bmi, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      level: result.levelLabel,
      activity: result.activityLabel,
    });

    const drink = result.drinkKcal
      ? t("plan.foodBali", { drink: num(result.drinkKcal), food: num(result.foodKcal) })
      : t("plan.foodAll");
    let pace = "";
    const weeksBit = result.kgDelta
      ? t(result.goal === "lose" ? "plan.weeksTo" : "plan.weeks", { n: num(result.weeks) })
      : "";
    if (result.goal === "lose" && result.deficit) {
      pace = t("plan.paceLose", {
        n: result.deficit,
        weeks: weeksBit,
        pace: num(result.pace, { maximumFractionDigits: 2 }),
      });
    } else if (result.goal === "gain" && result.surplus) {
      pace = t("plan.paceGain", { n: result.surplus, weeks: weeksBit });
    } else if (result.goal === "recomp") {
      pace = t("plan.paceRecomp", { n: result.deficit, strategy: result.strategyLabel });
    }
    document.getElementById("out-protocol").textContent = t("plan.proto", {
      target: num(result.target),
      drink: drink,
      pace: pace,
    });
    document.getElementById("out-meta").textContent = t("plan.meta", {
      limits: result.limits ? t("plan.limits", { n: result.limits }) : "",
    });

    const lang = I18N.lang();
    const split = (SPLIT[lang] || SPLIT.ru)[result.level] || (SPLIT[lang] || SPLIT.ru).active;
    document.getElementById("split-body").innerHTML = split
      .map((row) => "<tr><td>" + row[0] + "</td><td>" + row[1] + "</td></tr>")
      .join("");

    const food = document.getElementById("food-body");
    if (result.lifestyle === "bali") {
      document.getElementById("food-title").textContent = t("plan.foodBaliTitle");
      food.innerHTML =
        lang === "en"
          ? `<ul class="sans">
        <li>Every plate: protein (ayam / ikan / tempe / eggs), rice as a handful, not a tower.</li>
        <li>Say: <strong>nasi separuh</strong>, <strong>extra ayam/ikan</strong>, <strong>bakar, jangan goreng</strong>, sauce on the side.</li>
        <li>Canggu traps: granola smoothie bowls, mie goreng, pisang goreng, sweet es kopi susu.</li>
        ${result.drinkKcal ? "<li>* Beer is a fixed line. If you drink more at night, cut food the next day.</li>" : ""}
      </ul>`
          : `<ul class="sans">
        <li>Каждая тарелка: белок (ayam / ikan / tempe / яйца), рис — горсть, не башня.</li>
        <li>Говорить: <strong>nasi separuh</strong>, <strong>extra ayam/ikan</strong>, <strong>bakar, jangan goreng</strong>, соус отдельно.</li>
        <li>Ловушки Canggu: smoothie bowl с гранолой, mie goreng, pisang goreng, сладкий es kopi susu.</li>
        ${result.drinkKcal ? "<li>* Пиво — фиксированная статья. Если вечером больше — на следующий день минус еда.</li>" : ""}
      </ul>`;
    } else {
      document.getElementById("food-title").textContent = t("plan.foodTitle");
      food.innerHTML =
        lang === "en"
          ? `<ul class="sans">
        <li>Protein on every plate: meat, fish, eggs, cottage cheese, legumes.</li>
        <li>On gym days, keep carbs toward the top — before or right after training.</li>
        <li>On rest days you can cut carbs; leave protein alone.</li>
      </ul>`
          : `<ul class="sans">
        <li>Белок на каждой тарелке: мясо, рыба, яйца, творог, бобовые.</li>
        <li>В дни зала углеводы ближе к верху — до или сразу после тренировки.</li>
        <li>В дни отдыха углеводы можно урезать, белок не трогать.</li>
      </ul>`;
    }

    const back = "index.html" + location.search + "#calc";
    document.getElementById("edit-link").href = back;
    document.querySelector("footer a").href = back;
    const text = MityCalc.telegramText(input, result, result.recommend);
    const href = MITY.telegram + "?text=" + encodeURIComponent(text);
    document.getElementById("buy").href = href;
    document.getElementById("tg").href = href;
    document.getElementById("nav-tg").href = href;
    const diaryHref = "diary.html" + (location.search || "");
    const planDiary = document.getElementById("plan-diary");
    const openDiary = document.getElementById("open-diary");
    if (planDiary) planDiary.href = diaryHref;
    if (openDiary) openDiary.href = diaryHref;
  }

  paint();
  document.addEventListener("mity:lang", paint);
})();
