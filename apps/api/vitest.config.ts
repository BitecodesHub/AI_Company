import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';

export default defineConfig({
  // NestJS relies on `emitDecoratorMetadata` for DI; Vitest's default esbuild
  // transform drops it. unplugin-swc transforms TS with decorator metadata so
  // the full AppModule (guards, controllers, services) wires up under test.
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
        keepClassNames: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@bitecodes/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@bitecodes/db': resolve(__dirname, '../../packages/db/src/index.ts'),
      '@bitecodes/ai-core': resolve(__dirname, '../../packages/ai-core/src/index.ts'),
      '@bitecodes/ai-controller': resolve(__dirname, '../../packages/ai-controller/src/index.ts'),
      '@bitecodes/connectors': resolve(__dirname, '../../packages/connectors/src/index.ts'),
      '@bitecodes/mcp': resolve(__dirname, '../../packages/mcp/src/index.ts'),
      '@bitecodes/seo': resolve(__dirname, '../../packages/seo/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts', 'test/**/*.spec.ts', 'src/**/*.test.ts'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.module.ts', 'src/main.ts'],
      thresholds: { lines: 60 },
    },
  },
});
