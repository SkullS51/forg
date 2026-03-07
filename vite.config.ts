import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'; // Import the new plugin

export default defineConfig({
  plugins: [tailwindcss()],
});

    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(path.dirname(import.meta.url), '.'),
        }
      }
    };
});
