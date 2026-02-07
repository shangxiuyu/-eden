/**
 * AgentX API Service
 * 对接 Portagent 的 AgentX 接口
 */

const API_BASE = "/agentx";

export const agentxAPI = {
  /**
   * 获取 AgentX 平台信息
   */
  async getInfo(token) {
    const response = await fetch(`${API_BASE}/info`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error("Failed to get AgentX info");
    }
    return response.json(); // { version, wsPath }
  },
};
