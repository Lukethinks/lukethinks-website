import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://lukethinks.nl',
  output: 'static',
  adapter: vercel(),
  env: {
    schema: {
      KV_REST_API_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      KV_REST_API_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      REACTIONS_COOKIE_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
        default: '1dcff79446fea86ac745e0c22449ab76da33d073884fcae78402e2123b572af8',
      }),
    },
  },
});
