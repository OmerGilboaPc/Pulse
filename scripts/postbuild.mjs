// GitHub Pages has no SPA rewrites: serving index.html as 404.html lets deep
// links such as /Pulse/watchlist boot the app, which then routes client-side.
import { copyFileSync, writeFileSync, existsSync } from 'node:fs';

if (!existsSync('dist/index.html')) {
  console.error('postbuild: dist/index.html is missing — did the build fail?');
  process.exit(1);
}
copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
console.log('postbuild: wrote dist/404.html and dist/.nojekyll');
