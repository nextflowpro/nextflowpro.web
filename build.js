const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Compiling Tailwind CSS...');
  const stylePath = path.join(__dirname, 'assets', 'style.css');
  
  // Compile Tailwind CSS using local tailwindcss CLI with minify enabled (Cross-platform safe)
  const isWin = process.platform === 'win32';
  const cmd = isWin 
    ? 'npx.cmd --no-install @tailwindcss/cli -i ./input.css -o ./assets/style.css --minify'
    : 'npx --no-install @tailwindcss/cli -i ./input.css -o ./assets/style.css --minify';
  execSync(cmd, { stdio: 'pipe' });
  
  console.log('Inlining CSS into index.html...');
  const cssContent = fs.readFileSync(stylePath, 'utf8');
  
  const htmlPath = path.join(__dirname, 'index.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  // Matches <style id="tailwind-inline">...</style> or <link rel="stylesheet" href="assets/style.css" />
  const styleBlockRegex = /<style id="tailwind-inline">([\s\S]*?)<\/style>/;
  const linkStyleRegex = /<link rel="stylesheet" href="assets\/style.css"\s*\/?>/;
  
  if (styleBlockRegex.test(htmlContent)) {
    htmlContent = htmlContent.replace(styleBlockRegex, `<style id="tailwind-inline">${cssContent}</style>`);
    console.log('Successfully updated the existing inline style block in index.html!');
  } else if (linkStyleRegex.test(htmlContent)) {
    htmlContent = htmlContent.replace(linkStyleRegex, `<style id="tailwind-inline">${cssContent}</style>`);
    console.log('Successfully replaced stylesheet link with inline style block in index.html!');
  } else {
    console.warn('Warning: Could not find <style id="tailwind-inline"> or <link rel="stylesheet" href="assets/style.css"> in index.html!');
  }
  
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
