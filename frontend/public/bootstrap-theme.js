(function() {
  var VALID_MOTION = ["SYSTEM", "REDUCE", "NO_PREFERENCE"];
  var VALID_CONTRAST = ["SYSTEM", "HIGH", "NORMAL"];

  function applyPreferences() {
    var motion = "SYSTEM";
    var contrast = "SYSTEM";

    try {
      var raw = localStorage.getItem("rb_theme_prefs");
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (VALID_MOTION.indexOf(parsed.motion) !== -1) {
            motion = parsed.motion;
          }
          if (VALID_CONTRAST.indexOf(parsed.contrast) !== -1) {
            contrast = parsed.contrast;
          }
        }
      }
    } catch (e) {
      // Corrupted or inaccessible storage: fall back safely to defaults
      try {
        localStorage.removeItem("rb_theme_prefs");
      } catch (err) {}
    }

    var root = document.documentElement;

    root.setAttribute("data-motion", motion.toLowerCase());
    root.setAttribute("data-contrast", contrast.toLowerCase());

    // Evaluate motion
    var shouldReduceMotion = false;
    if (motion === "REDUCE") {
      shouldReduceMotion = true;
    } else if (motion === "SYSTEM" && window.matchMedia) {
      shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    if (shouldReduceMotion) {
      root.classList.add("reduce-motion");
      root.setAttribute("data-reduced-motion", "true");
    } else {
      root.classList.remove("reduce-motion");
      root.removeAttribute("data-reduced-motion");
    }

    // Evaluate contrast
    var shouldHighContrast = false;
    if (contrast === "HIGH") {
      shouldHighContrast = true;
    } else if (contrast === "SYSTEM" && window.matchMedia) {
      shouldHighContrast = window.matchMedia("(prefers-contrast: more)").matches;
    }

    if (shouldHighContrast) {
      root.classList.add("high-contrast");
      root.setAttribute("data-high-contrast", "true");
    } else {
      root.classList.remove("high-contrast");
      root.removeAttribute("data-high-contrast");
    }
  }

  applyPreferences();
})();
