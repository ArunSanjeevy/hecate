export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/hecate-sdk.cjs.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    {
      file: 'dist/hecate-sdk.esm.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/hecate-sdk.js',
      format: 'iife',
      name: 'Hecate',
      exports: 'named',
      sourcemap: true
    }
  ]
};
