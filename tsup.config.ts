import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/frameworks/express.ts',
    'src/frameworks/next.ts'
  ],
  format: ['cjs', 'esm'], // Gera tanto CommonJS (require) quanto ES Modules (import)
  dts: true, // Gera os arquivos de tipagem (.d.ts)
  splitting: false,
  sourcemap: true,
  clean: true, // Limpa a pasta dist antes de buildar
});
