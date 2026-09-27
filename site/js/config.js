window.MITY = {
  brand: "ProFitMITY",
  telegram: "https://t.me/mityTour",
  telegramHandle: "@mityTour",
  whatsapp: "https://wa.me/79958958555",
  email: "smittour@gmail.com",
  instagram: "",
  metrika: 113097278,
  usdRub: 84.1975,
  families: {
    self: { title: "Пакет «Сам» (без консультаций)", pill: "Без консультаций" },
    custom: { title: "Персональный план (консультации и разбор)", pill: "Консультации и разбор" },
    coach: { title: "Подписка", pill: "С разбором" },
    live: { title: "Онлайн-тренировки", pill: "В камере" },
  },
  products: {
    "self-train": {
      id: "self-train",
      family: "self",
      name: "Сам · план тренировок",
      usd: 33,
      billing: "once",
      extra: "product.chat3",
      blurb: "product.self-train.blurb",
    },
    "self-food": {
      id: "self-food",
      family: "self",
      name: "Сам · план питания",
      usd: 33,
      billing: "once",
      extra: "product.chat3",
      blurb: "product.self-food.blurb",
    },
    "self-both": {
      id: "self-both",
      family: "self",
      name: "Сам · тренировки + питание",
      usd: 49,
      billing: "once",
      extra: "product.chat3",
      blurb: "product.self-both.blurb",
    },
    "custom-train": {
      id: "custom-train",
      family: "custom",
      name: "Персональный план тренировок",
      usd: 75,
      billing: "once",
      blurb: "product.custom-train.blurb",
    },
    "custom-food": {
      id: "custom-food",
      family: "custom",
      name: "Персональный план питания",
      usd: 75,
      billing: "once",
      blurb: "product.custom-food.blurb",
    },
    "custom-both": {
      id: "custom-both",
      family: "custom",
      name: "Персональный план тренировки + питание",
      usd: 99,
      billing: "once",
      blurb: "product.custom-both.blurb",
    },
    "coach-review": {
      id: "coach-review",
      family: "coach",
      name: "Подписка · ревью",
      usd: 35,
      billing: "month",
      blurb: "product.coach-review.blurb",
    },
    "coach-train": {
      id: "coach-train",
      family: "coach",
      name: "Подписка · тренировки",
      usd: 126,
      billing: "month",
      blurb: "product.coach-train.blurb",
    },
    "coach-food": {
      id: "coach-food",
      family: "coach",
      name: "Подписка · питание",
      usd: 126,
      billing: "month",
      blurb: "product.coach-food.blurb",
    },
    "coach-both": {
      id: "coach-both",
      family: "coach",
      name: "Подписка · тренировки + питание",
      usd: 165,
      billing: "month",
      blurb: "product.coach-both.blurb",
    },
    "live-sub": {
      id: "live-sub",
      family: "live",
      name: "Онлайн-тренировки · подписка",
      usd: 165,
      billing: "month",
      blurb: "product.live-sub.blurb",
    },
    "live-once": {
      id: "live-once",
      family: "live",
      name: "Онлайн-тренировка · разовая",
      usd: 42,
      billing: "once",
      blurb: "product.live-once.blurb",
    },
    "live-six": {
      id: "live-six",
      family: "live",
      name: "Онлайн-тренировки · пакет 6",
      usd: 211,
      billing: "once",
      blurb: "product.live-six.blurb",
    },
  },
  rub: function (usd) {
    return Math.ceil((usd * this.usdRub) / 100) * 100;
  },
  priceView: function (product) {
    const t = window.I18N ? I18N.t.bind(I18N) : function (k) { return k; };
    const loc = window.I18N ? I18N.locale() : "ru-RU";
    const per = product.billing === "month" ? t("price.month") : "";
    let note = product.billing === "month" ? t("price.monthly") : t("price.once");
    if (product.extra) note += " · *" + t(product.extra);
    return {
      usd: "$" + product.usd + per,
      rub: this.rub(product.usd).toLocaleString(loc) + " ₽" + per,
      note: note,
    };
  },
  productName: function (id) {
    const t = window.I18N ? I18N.t.bind(I18N) : function (k) { return k; };
    return t("product." + id + ".name");
  },
  productBlurb: function (id) {
    const t = window.I18N ? I18N.t.bind(I18N) : function (k) { return k; };
    const product = this.products[id];
    return product ? t(product.blurb) : "";
  },
};
