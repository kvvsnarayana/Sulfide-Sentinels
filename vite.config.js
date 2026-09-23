import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import handler from './api/analyze-strip.js';

function groqDevApiPlugin() {
  return {
    name: 'groq-dev-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/analyze-strip', async (req, res) => {
        const env = loadEnv('development', process.cwd(), '');
        if (env.GROQ_API_KEY) {
          process.env.GROQ_API_KEY = env.GROQ_API_KEY;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            req.body = body ? JSON.parse(body) : {};
          } catch {
            req.body = {};
          }
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };
          try {
            await handler(req, res);
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    groqDevApiPlugin()
  ],
});
