import axios from "axios";

const TOKEN_KEY = "hashnode_jwt";
let unauthorizedHandler = null;
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      api.setToken(null);
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  }
);

api.setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

api.getToken = () => localStorage.getItem(TOKEN_KEY);

api.setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export default api;