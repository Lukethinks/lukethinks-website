import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://lukethinks.nl',
  output: 'static',
  adapter: vercel(),
  // Canonical URLs are extensionless with no trailing slash (see BaseLayout), so the sitemap matches.
  integrations: [
    sitemap({
      serialize(item) {
        item.url = item.url.replace(/(.)\/$/, '$1');
        return item;
      },
    }),
  ],
  env: {
    schema: {
      KV_REST_API_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      KV_REST_API_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      REACTIONS_COOKIE_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
});
