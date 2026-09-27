(function () {
  const id = window.MITY && Number(MITY.metrika);
  if (!id) return;

  (function (m, e, t, r, i, k, a) {
    m[i] =
      m[i] ||
      function () {
        (m[i].a = m[i].a || []).push(arguments);
      };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

  window.ym(id, "init", {
    clickmap: false,
    accurateTrackBounce: true,
    trackLinks: true,
    webvisor: false,
    defer: true,
  });

  function goal(name, params) {
    try {
      window.ym(id, "reachGoal", name, params || {});
    } catch (e) {}
  }

  const page = document.documentElement.getAttribute("data-page") || "other";
  goal("page_" + page);

  if (page === "home") {
    const results = document.getElementById("results");
    let calcSent = false;
    if (results && window.MutationObserver) {
      const sendCalc = function () {
        if (calcSent || results.classList.contains("hidden")) return;
        calcSent = true;
        goal("calc_done");
      };
      sendCalc();
      new MutationObserver(sendCalc).observe(results, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    const packs = document.getElementById("packs");
    if (packs && window.IntersectionObserver) {
      let packsSent = false;
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting || packsSent) return;
            packsSent = true;
            goal("packs_view");
            io.disconnect();
          });
        },
        { threshold: 0.35 }
      );
      io.observe(packs);
    }
  }

  document.addEventListener("click", function (event) {
    const a = event.target.closest("a");
    if (!a || !a.href) return;
    const href = a.getAttribute("href") || "";
    if (href.indexOf("t.me/") === -1 && href.indexOf("telegram") === -1) return;
    goal("tg_click", { product: a.dataset.product || "" });
  });
})();
