import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    generators: 'src/generators.ts',
    'adapters/middleware': 'src/adapters/middleware.ts',
    'storage/memory': 'src/storage/memory.ts',
    'storage/file': 'src/storage/file.ts',
    'storage/localstorage': 'src/storage/localstorage.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
