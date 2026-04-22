import { defineConfig, Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import fs from 'fs';

const OUTPUT_NAME = 'P-09-天体运动.html';

function renameOutput(): Plugin {
  return {
    name: 'rename-html',
    closeBundle() {
      const distDir = path.resolve(__dirname, '../../dist');
      const src = path.join(distDir, 'index.html');
      const dest = path.join(distDir, OUTPUT_NAME);
      if (fs.existsSync(src)) fs.renameSync(src, dest);
    },
  };
}

export default defineConfig({
  plugins: [viteSingleFile(), renameOutput()],
  root: __dirname,
  resolve: { alias: { '@physics/core': path.resolve(__dirname, '../core/src') } },
  build: { outDir: path.resolve(__dirname, '../../dist'), emptyOutDir: false },
});
