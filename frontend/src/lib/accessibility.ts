export type MotionPreference = "SYSTEM" | "REDUCE" | "NO_PREFERENCE";
export type ContrastPreference = "SYSTEM" | "HIGH" | "NORMAL";

const STORAGE_KEY = "rb_theme_prefs";
const BROADCAST_CHANNEL_NAME = "rolebrief_theme";

export function getCachedThemePreferences(): {
  motion: MotionPreference;
  contrast: ContrastPreference;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        motion: ["SYSTEM", "REDUCE", "NO_PREFERENCE"].includes(parsed.motion)
          ? parsed.motion
          : "SYSTEM",
        contrast: ["SYSTEM", "HIGH", "NORMAL"].includes(parsed.contrast)
          ? parsed.contrast
          : "SYSTEM"
      };
    }
  } catch {
    // corrupted cache safely ignored
  }
  return { motion: "SYSTEM", contrast: "SYSTEM" };
}

export function applyThemePreferences(
  motion: MotionPreference,
  contrast: ContrastPreference,
  broadcast = true
) {
  const root = document.documentElement;

  // Persist valid preferences to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ motion, contrast }));
  } catch {}

  root.setAttribute("data-motion", motion.toLowerCase());
  root.setAttribute("data-contrast", contrast.toLowerCase());

  // Apply motion
  let reduce = false;
  if (motion === "REDUCE") {
    reduce = true;
  } else if (motion === "SYSTEM" && typeof window !== "undefined" && window.matchMedia) {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  if (reduce) {
    root.classList.add("reduce-motion");
    root.setAttribute("data-reduced-motion", "true");
  } else {
    root.classList.remove("reduce-motion");
    root.removeAttribute("data-reduced-motion");
  }

  // Apply contrast
  let highContrast = false;
  if (contrast === "HIGH") {
    highContrast = true;
  } else if (contrast === "SYSTEM" && typeof window !== "undefined" && window.matchMedia) {
    highContrast = window.matchMedia("(prefers-contrast: more)").matches;
  }

  if (highContrast) {
    root.classList.add("high-contrast");
    root.setAttribute("data-high-contrast", "true");
  } else {
    root.classList.remove("high-contrast");
    root.removeAttribute("data-high-contrast");
  }

  // Broadcast to other open tabs
  if (broadcast && typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage({ motion, contrast });
      bc.close();
    } catch {}
  }
}

export function clearCachedThemePreferences() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  applyThemePreferences("SYSTEM", "SYSTEM", false);
}

export function subscribeToAccessibilityChanges(
  getCurrentPrefs: () => { motion: MotionPreference; contrast: ContrastPreference },
  onExternalChange?: (prefs: { motion: MotionPreference; contrast: ContrastPreference }) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const motionMql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const contrastMql = window.matchMedia?.("(prefers-contrast: more)");

  const handleMediaChange = () => {
    const { motion, contrast } = getCurrentPrefs();
    applyThemePreferences(motion, contrast, false);
  };

  motionMql?.addEventListener?.("change", handleMediaChange);
  contrastMql?.addEventListener?.("change", handleMediaChange);

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data && event.data.motion && event.data.contrast) {
          applyThemePreferences(event.data.motion, event.data.contrast, false);
          onExternalChange?.(event.data);
        }
      };
    } catch {}
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        applyThemePreferences(parsed.motion, parsed.contrast, false);
        onExternalChange?.(parsed);
      } catch {}
    } else if (e.key === STORAGE_KEY && !e.newValue) {
      applyThemePreferences("SYSTEM", "SYSTEM", false);
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    motionMql?.removeEventListener?.("change", handleMediaChange);
    contrastMql?.removeEventListener?.("change", handleMediaChange);
    window.removeEventListener("storage", handleStorage);
    if (bc) {
      bc.close();
    }
  };
}
