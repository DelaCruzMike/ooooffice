import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], base: process.env.BASE_PATH || '/', build: { target: 'es2022', chunkSizeWarningLimit: 1800, rollupOptions: { output: { manualChunks(id) { if(id.includes('/@babylonjs/core/')) return 'office-3d'; if(id.includes('/livekit-client/')) return 'office-audio'; if(id.includes('/@supabase/')) return 'office-accounts'; } } } } });
