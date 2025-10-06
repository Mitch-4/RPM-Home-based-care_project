// src/context/ThemeContext.js
import React, { createContext, useState, useEffect } from "react";

// Create Context
export const ThemeContext = createContext();

// Theme Provider
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");

  // Load theme from localStorage (so it remembers after refresh)
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.add(savedTheme);
    }
  }, []);

  // Update theme + save to localStorage
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);

    // Remove old theme class, add new one
    document.documentElement.classList.remove(theme);
    document.documentElement.classList.add(newTheme);

    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
