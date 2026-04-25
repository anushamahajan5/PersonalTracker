import axios from "axios";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
export const API = `${BACKEND_URL}/api`; // Corrected to include /api prefix
console.log("API Base URL:", API); 
export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Fallback bearer header support (in case cross-site cookies blocked)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong"; // Default error message
  if (typeof detail === "string") return detail; // If detail is a string, return it directly
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" "); // Join array of error messages
  if (detail && typeof detail.msg === "string") return detail.msg; // If detail has a 'msg' property, return it
  return String(detail); // Fallback to string conversion
}