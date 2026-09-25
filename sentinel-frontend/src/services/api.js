import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
      "Sentinel-X API error:",
      error
    );

    return Promise.reject(error);
  }
);

export default api;