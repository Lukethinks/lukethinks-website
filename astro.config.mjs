import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://lukethinks.nl',
  output: 'static',
  adapter: vercel(),
  env: {
    schema: {
      KV_REST_API_URL: envField.string({ context: 'server', access: 'secret' }),
      KV_REST_API_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      REACTIONS_COOKIE_SECRET: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
