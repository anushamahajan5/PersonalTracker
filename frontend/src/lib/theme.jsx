import { createContext, useContext, useEffect, useState } from "react";

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("theme") || "dark";
    }
    return "dark"; // Default theme for server-side rendering
  });
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    if (typeof window !== 'undefined') { 
      localStorage.setItem("theme", theme);
    }
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark")); // Toggle between dark and light themes
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);