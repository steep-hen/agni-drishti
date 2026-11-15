/// <reference types="vite/client" />

/**
 * Central API base URL configuration.
 * - In production (Railway, Render, etc.): defaults to '/api' (same origin).
 * - In local development: defaults to 'http://localhost:3001/api'.
 * - Can be overridden anytime via VITE_API_URL env variable.
 */
const metaEnv = (import.meta as unknown as { env?: Record<string, string | boolean> }).env;
export const API = (metaEnv?.VITE_API_URL as string) || (metaEnv?.DEV ? 'http://localhost:3001/api' : '/api');
