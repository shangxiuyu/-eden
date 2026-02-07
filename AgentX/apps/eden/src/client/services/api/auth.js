/**
 * Authentication API Service
 * 对接 Portagent 的认证接口
 */

const API_BASE = "/api/auth";

export const authAPI = {
  /**
   * 用户注册
   */
  async register(username, password, inviteCode) {
    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, inviteCode }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Registration failed");
    }
    return response.json();
  },

  /**
   * 用户登录
   */
  async login(username, password) {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail: username, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }
    return response.json(); // { token, user, expiresIn }
  },

  /**
   * 验证 token
   */
  async verify(token) {
    const response = await fetch(`${API_BASE}/verify`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error("Token verification failed");
    }
    return response.json(); // { user }
  },
};
