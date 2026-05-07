const fs = require('fs');
let index = fs.readFileSync('src/index.html', 'utf8');

index = index.replace('--card: rgba(15, 23, 42, 0.6);', '--card: rgba(41, 41, 39, 0.6);');
index = index.replace('background-color: #0284c7;', 'background-color: #d85d14;');
index = index.replace(/rgba\(14, 165, 233, 0\.12\)/g, 'rgba(239, 112, 33, 0.12)');
index = index.replace(/rgba\(14, 165, 233, 0\.35\)/g, 'rgba(239, 112, 33, 0.35)');

fs.writeFileSync('src/index.html', index);
