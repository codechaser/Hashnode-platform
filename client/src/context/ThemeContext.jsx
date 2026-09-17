import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "hashnode_theme";
const ThemeContext = createContext(null);

function getStoredPreference() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getStoredPreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const resolvedTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => setSystemTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference, resolvedTheme]);

  const value = useMemo(() => ({
    preference,
    resolvedTheme,
    setPreference,
  }), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
