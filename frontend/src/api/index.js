import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || '/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send cookies (session auth)
});

// Django CSRF token interceptor
// Django's session auth requires X-CSRFToken header on mutating requests
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

api.interceptors.request.use((config) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase())) {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }
  return config;
});

// Auth
export const authAPI = {
  register: (username, password) => api.post('/auth/register/', { username, password }),
  login: (username, password) => api.post('/auth/login/', { username, password }),
  logout: () => api.post('/auth/logout/'),
  me: () => api.get('/auth/me/'),
};

// Posts
export const postsAPI = {
  list: (limit = 20, offset = 0) => api.get('/posts/', { params: { limit, offset } }),
  detail: (id) => api.get(`/posts/${id}/`),
  create: (content) => api.post('/posts/', { content }),
};

// Comments
export const commentsAPI = {
  create: (postId, content, parentId = null) =>
    api.post(`/posts/${postId}/comments/`, { content, parent: parentId }),
};

// Likes
export const likesAPI = {
  toggle: (targetType, targetId) =>
    api.post('/like/', { target_type: targetType, target_id: targetId }),
};

// Leaderboard
export const leaderboardAPI = {
  get: () => api.get('/leaderboard/'),
};

export default api;
