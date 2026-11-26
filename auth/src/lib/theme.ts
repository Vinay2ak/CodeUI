export type Theme = "dark" | "light";

const STORAGE_KEY = "cb-theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") {
    return "dark";
  }
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") {
    return;
  }
  if (theme === "light") {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
