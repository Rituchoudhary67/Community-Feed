import React, { useState } from 'react';
import { likesAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LikeButton({ targetType, targetId, likeCount, isLiked: initialIsLiked }) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(initialIsLiked || false);
  const [count, setCount] = useState(likeCount || 0);
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (!user || loading) return;

    const prevLiked = isLiked;
    const prevCount = count;
    setIsLiked(!isLiked);
    setCount(isLiked ? count - 1 : count + 1);
    setAnimating(true);
    setLoading(true);

    setTimeout(() => setAnimating(false), 400);

    try {
      const res = await likesAPI.toggle(targetType, targetId);
      const serverLiked = res.data.is_liked;
      if (serverLiked !== !prevLiked) {
        setIsLiked(serverLiked);
        setCount(prevCount + (serverLiked ? 1 : 0));
      }
    } catch (err) {
      setIsLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      className={`
        flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-xs transition-all
        ${isLiked
          ? 'bg-red-50 text-red-600 border border-red-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
        }
        ${user ? 'cursor-pointer' : 'cursor-default opacity-60'}
      `}
      title={user ? (isLiked ? 'Unlike' : 'Like') : 'Log in to like'}
    >
      <span className={animating ? 'animate-pulse-once' : ''}>
        {isLiked ? '❤️' : '🤍'}
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}