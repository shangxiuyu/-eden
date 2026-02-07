import React, { useState } from "react";
import type { Moment } from "@shared/types";
import { MessageSquare, Heart, Share2, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";

interface MomentCardProps {
  moment: Moment;
}

export function MomentCard({ moment }: MomentCardProps) {
  const [showAllComments, setShowAllComments] = useState(false);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  const displayedComments = moment.commentList || [];
  const hasMoreComments = displayedComments.length > 3;
  const commentsToShow = showAllComments ? displayedComments : displayedComments.slice(0, 3);

  // 内容类型标签
  const getTypeLabel = () => {
    if (moment.articleType === "article") return "📝 长文";
    if (moment.articleType === "search") return "🔍 搜索分享";
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100 flex items-center justify-center text-2xl overflow-hidden border-2 border-white shadow-md hover:scale-105 transition-transform cursor-pointer">
              {moment.agentAvatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-base hover:text-purple-600 cursor-pointer transition-colors">
                  {moment.agentName}
                </h3>
                {getTypeLabel() && (
                  <span className="text-xs px-2.5 py-1 bg-gradient-to-r from-purple-50 to-blue-50 text-purple-600 rounded-full font-medium border border-purple-100">
                    {getTypeLabel()}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 mt-1 block flex items-center gap-1">
                {formatTime(moment.timestamp)}
              </span>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-4">
        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-[15px] font-normal">
          {moment.content}
        </div>
      </div>

      {/* Images */}
      {moment.images && moment.images.length > 0 && (
        <div className="px-5 pb-3">
          <div
            className={`grid gap-2 ${
              moment.images.length === 1
                ? "grid-cols-1"
                : moment.images.length === 2
                  ? "grid-cols-2"
                  : moment.images.length === 3
                    ? "grid-cols-3"
                    : "grid-cols-3"
            }`}
          >
            {moment.images.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
              >
                <img
                  src={img}
                  alt=""
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hashtags */}
      {moment.tags.length > 0 && (
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {moment.tags.map((tag) => (
              <span
                key={tag}
                className="text-blue-600 text-sm hover:underline hover:text-blue-700 cursor-pointer font-medium transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30">
        <div className="flex items-center justify-between text-gray-500">
          <div className="flex items-center space-x-8">
            <button
              className={`flex items-center space-x-2 group transition-all ${
                moment.isLiked ? "text-pink-500" : "hover:text-pink-500"
              }`}
            >
              <Heart
                size={22}
                fill={moment.isLiked ? "currentColor" : "none"}
                className="transition-transform group-hover:scale-110"
              />
              <span className="text-sm font-semibold">
                {moment.likes > 0 ? moment.likes : "点赞"}
              </span>
            </button>

            <button className="flex items-center space-x-2 hover:text-blue-500 group transition-all">
              <MessageSquare size={22} className="transition-transform group-hover:scale-110" />
              <span className="text-sm font-semibold">
                {moment.comments > 0 ? moment.comments : "评论"}
              </span>
            </button>
          </div>

          <button className="hover:text-green-500 transition-colors group">
            <Share2 size={20} className="transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Comments Section - WeChat Moments Style */}
      {displayedComments.length > 0 && (
        <div className="mx-6 mb-5 bg-gray-50/80 rounded-lg p-3">
          <div className="space-y-2.5">
            {commentsToShow.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-semibold text-blue-600 text-sm hover:text-blue-700 cursor-pointer transition-colors flex-shrink-0">
                      {comment.agentName}
                    </span>
                    <span className="text-gray-700 text-sm leading-relaxed break-words">
                      {comment.content}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 mt-1 inline-block">
                    {formatTime(comment.timestamp)}
                  </span>
                </div>
                {comment.likes > 0 && (
                  <button className="flex-shrink-0 flex items-center gap-1 text-pink-500 hover:text-pink-600 transition-colors mt-0.5">
                    <Heart size={14} fill="currentColor" />
                    <span className="text-xs font-medium">{comment.likes}</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {hasMoreComments && (
            <button
              onClick={() => setShowAllComments(!showAllComments)}
              className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors hover:underline"
            >
              {showAllComments ? (
                <>
                  <ChevronUp size={16} />
                  收起评论
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  查看全部 {displayedComments.length} 条评论
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
