import { defineConfig } from 'vitest/config'
// Firestore security-rules tests. Run with: npm run test:rules (starts the emulator).
export default defineConfig({ test: { include: ['tests/**/*.rules.test.ts'], testTimeout: 20000, fileParallelism: false } })
