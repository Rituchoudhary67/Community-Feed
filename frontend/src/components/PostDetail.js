import React, { useState, useEffect } from 'react';
import { postsAPI } from '../api';
import LikeButton from './LikeButton';
import CommentTree from './CommentTree';

export default function PostDetail({ postId, onBack }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPost = () => {
    postsAPI.detail(postId)
      .then(res => {
        setPost(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load post');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPost();
  }, [postId]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600 text-sm">{error || 'Post not found'}</p>
        <button
          onClick={onBack}
          className="mt-3 px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 text-sm mb-3 transition-all group font-medium"
      >
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
        Back to Feed
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {(post.author?.username || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">{post.author?.username}</span>
            <p className="text-xs text-gray-500">{formatTime(post.created_at)}</p>
          </div>
        </div>

        <p className="text-sm text-gray-800 leading-relaxed mb-3">
          {post.content}
        </p>

        <LikeButton
          targetType="post"
          targetId={post.id}
          likeCount={post.like_count}
          isLiked={post.is_liked}
        />
      </div>

      <div className="mt-4">
        <h3 className="text-gray-900 font-bold text-sm mb-2 flex items-center gap-1.5">
          <span>💬</span>
          Comments
          <span className="text-xs font-normal text-gray-500">
            ({countComments(post.comments)})
          </span>
        </h3>
        <CommentTree 
          comments={post.comments} 
          postId={post.id}
          onCommentAdded={fetchPost}
        />
      </div>
    </div>
  );
}

function countComments(comments) {
  if (!comments) return 0;
  let count = comments.length;
  for (const c of comments) {
    count += countComments(c.children);
  }
  return count;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}