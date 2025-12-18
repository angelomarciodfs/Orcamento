
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'lucide-react',
        'recharts',
        'xlsx',
        '@google/genai',
        '@supabase/supabase-js'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'lucide-react': 'LucideReact',
          'recharts': 'Recharts',
          'xlsx': 'XLSX',
          '@google/genai': 'GoogleGenAI',
          '@supabase/supabase-js': 'Supabase'
        }
      }
    }
  }
});
