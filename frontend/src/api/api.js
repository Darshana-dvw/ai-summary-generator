// src/api/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("meetmind_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("meetmind_token");
      localStorage.removeItem("meetmind_user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default api;
