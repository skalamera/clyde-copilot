const fs = require('fs');
const indexFile = './src/index.html';
let content = fs.readFileSync(indexFile, 'utf8');

// Colors
content = content.replace('--background: #111827;', '--background: rgba(41, 41, 39, 0.85);');
content = content.replace('--primary: #0ea5e9;', '--primary: #ef7021;');
content = content.replace('--primary-glow: rgba(14, 165, 233, 0.4);', '--primary-glow: rgba(239, 112, 33, 0.4);');
content = content.replace('--secondary: #1e293b;', '--secondary: #1f9937;');
content = content.replace('--accent: #a855f7;', '--accent: #5e17eb;');
content = content.replace('--accent-glow: rgba(168, 85, 247, 0.4);', '--accent-glow: rgba(94, 23, 235, 0.4);');

// Change card and panels backgrounds to use the new #292927 (rgb 41,41,39)
content = content.replace(/rgba\(30, 41, 59, 0\.7\)/g, 'rgba(41, 41, 39, 0.7)');
content = content.replace(/rgba\(15, 23, 42, 0\.4\)/g, 'rgba(20, 20, 20, 0.4)');
content = content.replace(/rgba\(15, 23, 42, 0\.5\)/g, 'rgba(41, 41, 39, 0.5)');
content = content.replace(/rgba\(15, 23, 42, 0\.72\)/g, 'rgba(41, 41, 39, 0.72)');

fs.writeFileSync(indexFile, content);
