import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // On Vercel this app is served under /admin (see vercel.json rewrites);
  // locally it owns the whole origin on :5175.
  base: process.env.VERCEL ? '/admin/' : '/',
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
});
