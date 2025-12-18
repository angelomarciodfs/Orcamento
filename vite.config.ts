
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Define process.env para evitar erros em tempo de execução/build
    'process.env': {}
  },
  build: {
    rollupOptions: {
      // Lista de módulos que devem ser tratados como externos (carregados via CDN/importmap)
      external: [
        'react',
        'react-dom',
        'lucide-react',
        'recharts',
        'xlsx',
        '@google/genai',
        '@google/generative-ai',
        'react/jsx-runtime'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'lucide-react': 'LucideReact',
          'recharts': 'Recharts',
          'xlsx': 'XLSX',
          '@google/genai': 'GoogleGenAI'
        }
      }
    }
  }
});
