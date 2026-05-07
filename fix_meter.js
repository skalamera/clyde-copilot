const fs = require('fs');
let index = fs.readFileSync('src/index.html', 'utf8');

index = index.replace(/rgba\(15, 23, 42, 0\.78\)/g, 'rgba(41, 41, 39, 0.78)');
index = index.replace(/rgba\(15, 23, 42, 0\.2\)/g, 'rgba(41, 41, 39, 0.2)');

fs.writeFileSync('src/index.html', index);
