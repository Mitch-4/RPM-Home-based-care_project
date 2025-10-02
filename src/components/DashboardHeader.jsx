// src/components/DashboardHeader.js
import React from "react";
import ThemeToggle from "./ThemeToggle";

const DashboardHeader = ({ title, user }) => {
  return (
    <header
      className="flex justify-between items-center p-4 border-b shadow-sm 
                 bg-white dark:bg-gray-900 dark:text-white"
    >
      {/* Title */}
      <h2 className="text-xl font-bold">{title}</h2>

      {/* Right section: Theme toggle + user info */}
      <div className="flex items-center gap-4">
        <ThemeToggle />
        {user && (
          <div className="flex flex-col text-sm text-right">
            <span className="font-medium">{user.name}</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              {user.role}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default DashboardHeader;
