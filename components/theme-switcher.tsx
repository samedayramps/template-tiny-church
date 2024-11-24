"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex w-full items-center">
      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="flex w-full items-center"
      >
        {theme === "light" ? (
          <>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark Mode</span>
          </>
        ) : (
          <>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light Mode</span>
          </>
        )}
      </button>
    </div>
  );
}
