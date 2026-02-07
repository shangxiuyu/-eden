/**
 * [INPUT]: 依赖 zustand
 * [OUTPUT]: 对外提供 useAuthStore hook
 * [POS]: store/ 的认证状态管理，支持持久化到 localStorage
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authAPI } from "@/services/api";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // 注册
      register: async (username, password, inviteCode) => {
        try {
          const { token, user } = await authAPI.register(username, password, inviteCode);
          set({ user, token, isAuthenticated: true });
          return { success: true, user };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      // 登录
      login: async (username, password) => {
        try {
          const { token, user } = await authAPI.login(username, password);
          set({ user, token, isAuthenticated: true });
          return { success: true, user };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      // 验证 token
      verify: async () => {
        const { token } = get();
        if (!token) {
          set({ user: null, token: null, isAuthenticated: false });
          return { success: false };
        }
        try {
          const { user } = await authAPI.verify(token);
          set({ user, isAuthenticated: true });
          return { success: true, user };
        } catch (error) {
          set({ user: null, token: null, isAuthenticated: false });
          return { success: false };
        }
      },

      // 登出
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: "eden-auth-storage", // 存储在 localStorage 中的键名
    }
  )
);
