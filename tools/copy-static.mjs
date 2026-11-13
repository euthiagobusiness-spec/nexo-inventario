import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/frontend/', root), { recursive: true });
for (const name of ['index.html', 'styles.css']) await copyFile(new URL(`frontend/public/${name}`, root), new URL(`dist/frontend/${name}`, root));
await copyFile(new URL('dist/frontend-build/frontend/src/app.js', root), new URL('dist/frontend/app.js', root));
await copyFile(new URL('dist/frontend-build/frontend/src/app.js.map', root), new URL('dist/frontend/app.js.map', root));
console.log('Frontend compilado:', fileURLToPath(new URL('dist/frontend/', root)));
