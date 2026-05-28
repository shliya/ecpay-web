const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'static', 'crowdfunding-data');
const dest = path.join(__dirname, '..', 'public', 'crowdfunding-data');

if (!fs.existsSync(src)) {
    console.warn('[copy-crowdfunding-data] source missing:', src);
    process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
    if (!name.endsWith('.json')) continue;
    fs.copyFileSync(path.join(src, name), path.join(dest, name));
}
console.log('[copy-crowdfunding-data] copied to', dest);
