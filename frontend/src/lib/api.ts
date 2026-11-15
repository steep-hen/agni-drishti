/**
 * Central API base URL configuration.
 * - In production (Railway, Render, etc.): defaults to '/api' (same origin).
 * - In local development: defaults to 'http://localhost:3001/api'.
 * - Can be overridden anytime via VITE_API_URL env variable.
 */
export const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');
