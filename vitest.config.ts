import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Délai large : le bêta-test peut générer des centaines de milliers de phrases.
  test: { include: ['tests/**/*.test.ts'], testTimeout: 900_000 },
});
