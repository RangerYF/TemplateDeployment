import { defineConfig, UserConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export function createModuleConfig(moduleName: string): UserConfig {
  return {
    plugins: [viteSingleFile()],
    resolve: {
      alias: {
        '@physics/core': path.resolve(__dirname, 'packages/core/src'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: false,
      rollupOptions: {
        output: {
          entryFileNames: `${moduleName}.js`,
        },
      },
    },
  };
}
