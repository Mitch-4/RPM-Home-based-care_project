// src/components/ThemeToggle.js
import React, { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button
      onClick={toggleTheme}
      className={`px-4 py-2 rounded-lg font-semibold shadow-md transition-colors duration-300
        ${theme === "light" 
          ? "bg-gray-200 text-gray-900 hover:bg-gray-300" 
          : "bg-gray-800 text-gray-100 hover:bg-gray-700"}`}
    >
      {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
    </button>
  );
};

export default ThemeToggle;
