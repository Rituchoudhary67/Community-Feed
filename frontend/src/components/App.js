import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { postsAPI } from '../api';
import LikeButton from './LikeButton';
import PostDetail from './PostDetail';
import Leaderboard from './Leaderboard';
import AuthModal from './AuthModal';

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await postsAPI.list(50, 0);
      const data = res.data.results || res.data;
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchPosts();
  }, [authLoading, fetchPosts]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() || creatingPost) return;
    setCreatingPost(true);
    try {
      const res = await postsAPI.create(newPostText.trim());
      setPosts(prev => [res.data, ...prev]);
      setNewPostText('');
    } catch (err) {
      console.error('Create post failed', err);
      alert('Failed to create post. Please try again.');
    } finally {
      setCreatingPost(false);
    }
  };

  if (selectedPostId) {
    return (
      <Layout user={user} onAuthClick={() => setAuthModalOpen(true)} onLogout={logout}>
        <div className="max-w-4xl mx-auto px-3 py-4">
          <PostDetail postId={selectedPostId} onBack={() => setSelectedPostId(null)} />
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </Layout>
    );
  }

  return (
    <Layout user={user} onAuthClick={() => setAuthModalOpen(true)} onLogout={logout}>
      <div className="max-w-6xl mx-auto px-3 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {user && (
              <form onSubmit={handleCreatePost} className="mb-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{user.username[0].toUpperCase()}</span>
                    </div>
                    <span className="text-gray-600 text-sm font-medium">What's on your mind?</span>
                  </div>
                  <textarea
                    value={newPostText}
                    onChange={e => setNewPostText(e.target.value)}
                    placeholder="Share something..."
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!newPostText.trim() || creatingPost}
                      className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {creatingPost ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700">Recent Posts</h2>
              <span className="text-xs text-gray-500">{posts.length} posts</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg p-4 animate-pulse shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div className="h-3 bg-gray-200 rounded w-24" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2.5 bg-gray-200 rounded w-full" />
                      <div className="h-2.5 bg-gray-200 rounded w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onClick={() => setSelectedPostId(post.id)}
                    animDelay={index * 30}
                  />
                ))}

                {posts.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm">No posts yet</p>
                    {!user && (
                      <button
                        onClick={() => setAuthModalOpen(true)}
                        className="mt-3 px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Log in to post
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-3">
              <Leaderboard />

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <h4 className="text-xs font-bold text-gray-900 mb-2">Karma System</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <span className="text-red-500">❤️</span> Post like
                    </span>
                    <span className="text-orange-600 font-bold">+5</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <span className="text-red-500">❤️</span> Comment like
                    </span>
                    <span className="text-orange-600 font-bold">+1</span>
                  </div>
                </div>
              </div>

              {!user && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-blue-900 text-sm font-medium mb-2">Join Community</p>
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full px-3 py-1.5 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Log In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </Layout>
  );
}

function PostCard({ post, onClick, animDelay }) {
  return (
    <div
      className="animate-slideUp cursor-pointer"
      style={{ animationDelay: `${animDelay}ms` }}
      onClick={onClick}
    >
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {(post.author?.username || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900">{post.author?.username}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">{formatTime(post.created_at)}</span>
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-2.5">
          {post.content}
        </p>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <LikeButton
            targetType="post"
            targetId={post.id}
            likeCount={post.like_count}
            isLiked={post.is_liked}
          />
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-all font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}

function Layout({ user, onAuthClick, onLogout, children }) {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">💬</span>
            </div>
            <span className="text-base font-bold text-gray-900">Playto Community</span>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2.5 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{user.username[0].toUpperCase()}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-700">{user.username}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="text-xs text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-all font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={onAuthClick}
                className="px-4 py-1.5 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="border-t border-gray-200 py-4 mt-8 bg-white">
        <p className="text-center text-xs text-gray-500">
          Playto Engineering Challenge · Community Feed
        </p>
      </footer>
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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}