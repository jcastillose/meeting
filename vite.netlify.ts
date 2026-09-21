import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:'portable',plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname)}},publicDir:'../public',build:{outDir:'../dist-netlify',emptyOutDir:true}});
