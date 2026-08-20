import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import awsAmplify from 'astro-aws-amplify';

export default defineConfig({
  output: 'server',
  adapter: awsAmplify(),
  integrations: [react()],
  image: {
    // No image optimization — avoids a sharp dependency in the compute bundle.
    service: { entrypoint: 'astro/assets/services/noop' },
  },
});
