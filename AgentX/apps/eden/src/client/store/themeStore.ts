import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeId = "light" | "dark" | "desert";

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light", // Default theme
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "eden-theme-storage",
    }
  )
);
