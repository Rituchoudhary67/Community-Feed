import React, { useState } from 'react';
import LikeButton from './LikeButton';
import { commentsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

function CommentNode({ comment, postId, onNewComment, maxDepth = 6 }) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const hasChildren = comment.children && comment.children.length > 0;
  const depth = comment.depth || 0;

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await commentsAPI.create(postId, replyText.trim(), comment.id);
      const newComment = {
        id: res.data.id,
        author: { id: user.id, username: user.username },
        content: res.data.content,
        depth: res.data.depth,
        like_count: 0,
        created_at: res.data.created_at,
        parent_id: comment.id,
        children: [],
        is_liked: false,
      };
      onNewComment(comment.id, newComment);
      setReplyText('');
      setReplying(false);
      setExpanded(true);
    } catch (err) {
      console.error('Reply failed', err);
      alert('Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const indentLevel = Math.min(depth, maxDepth);
  const indentPx = indentLevel * 12;

  return (
    <div className="animate-fadeIn" style={{ marginLeft: `${indentPx}px` }}>
      <div className="relative group mb-1.5 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-all">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg bg-blue-400" />

        <div className="p-2 pl-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {(comment.author?.username || 'U')[0].toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-semibold text-gray-900">
              {comment.author?.username || 'Unknown'}
            </span>
            <span className="text-xs text-gray-400">{formatTime(comment.created_at)}</span>
          </div>

          <p className="text-xs text-gray-700 leading-relaxed mb-1.5 pl-6">
            {comment.content}
          </p>

          <div className="flex items-center gap-1.5 pl-6">
            <LikeButton
              targetType="comment"
              targetId={comment.id}
              likeCount={comment.like_count}
              isLiked={comment.is_liked}
            />

            {user && (
              <button
                onClick={() => { setReplying(!replying); setReplyText(''); }}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors px-1.5 py-0.5 rounded hover:bg-blue-50 font-medium"
              >
                {replying ? 'Cancel' : 'Reply'}
              </button>
            )}

            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-100 ml-auto font-medium"
              >
                {expanded ? `− ${comment.children.length}` : `+ ${comment.children.length}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {replying && (
        <div className="mt-1 mb-2 animate-slideUp" style={{ marginLeft: '12px' }}>
          <form onSubmit={handleReply} className="flex flex-col gap-1.5">
            <textarea
              autoFocus
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={`Reply to ${comment.author?.username}...`}
              rows={2}
              className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || submitting}
              className="self-start px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Posting...' : 'Reply'}
            </button>
          </form>
        </div>
      )}

      {hasChildren && expanded && (
        <div className="mt-0.5">
          {comment.children.map(child => (
            <CommentNode
              key={child.id}
              comment={child}
              postId={postId}
              onNewComment={onNewComment}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentTree({ comments, postId, onCommentAdded }) {
  const { user } = useAuth();
  const [newTopComment, setNewTopComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState(comments || []);

  React.useEffect(() => {
    setLocalComments(comments || []);
  }, [comments]);

  const handleNewComment = async (e) => {
    e.preventDefault();
    if (!newTopComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await commentsAPI.create(postId, newTopComment.trim(), null);
      const newComment = {
        id: res.data.id,
        author: { id: user.id, username: user.username },
        content: res.data.content,
        depth: 0,
        like_count: 0,
        created_at: res.data.created_at,
        parent_id: null,
        children: [],
        is_liked: false,
      };
      setLocalComments(prev => [...prev, newComment]);
      setNewTopComment('');
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      console.error('Comment failed', err);
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const insertReply = (parentId, newReply) => {
    const insertIntoNode = (nodes) => {
      return nodes.map(node => {
        if (node.id === parentId) {
          return { ...node, children: [...(node.children || []), newReply] };
        }
        if (node.children && node.children.length > 0) {
          return { ...node, children: insertIntoNode(node.children) };
        }
        return node;
      });
    };
    setLocalComments(prev => insertIntoNode(prev));
  };

  return (
    <div className="mt-4">
      {user && (
        <form onSubmit={handleNewComment} className="mb-3">
          <div className="bg-white border border-gray-200 rounded-lg p-2.5">
            <textarea
              value={newTopComment}
              onChange={e => setNewTopComment(e.target.value)}
              placeholder="Write a comment..."
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-400 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newTopComment.trim() || submitting}
                className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Posting...' : 'Comment'}
              </button>
            </div>
          </div>
        </form>
      )}

      {localComments.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 text-xs">No comments yet</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {user ? 'Be the first!' : 'Log in to comment'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {localComments.map(comment => (
            <CommentNode
              key={comment.id}
              comment={comment}
              postId={postId}
              onNewComment={insertReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}