// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'it', 'pt'],
    routing: {
      prefixDefaultLocale: false, // / → es, /it/ → it, /pt/ → pt
    },
  },

  adapter: cloudflare(),
});