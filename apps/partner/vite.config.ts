import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  // On Vercel this app is served under /partner (see vercel.json rewrites);
  // locally it owns the whole origin on :5174.
  base: process.env.VERCEL ? '/partner/' : '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
