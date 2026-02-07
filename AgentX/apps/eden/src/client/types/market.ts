/**
 * Agent市场相关类型定义
 */

export interface MarketAgentListItem {
  id: string;
  name: string;
  avatar: string;
  description: string;
  publisherName: string;
  version: string;
  downloads: number;
  rating: number;
  tags: string[];
  createdAt: number;
}
