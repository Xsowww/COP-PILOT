import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleCopilot } from './server/copilot.mjs';

/** Serves Copilot's API during `npm run dev` (same handler as server/index.mjs). */
function copilotApi(env: Record<string, string>): Plugin {
  return {
    name: 'copilot-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!(await handleCopilot(req, res, env))) next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') } as Record<string, string>;
  return {
    plugins: [tailwindcss(), react(), copilotApi(env)],
  };
});
