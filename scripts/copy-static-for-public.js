const fs = require('fs');
const path = require('path');

function copyDirFiles(srcDir, destDir, filter) {
    if (!fs.existsSync(srcDir)) {
        console.warn('[copy-static] source missing:', srcDir);
        return;
    }
    fs.mkdirSync(destDir, { recursive: true });
    for (const name of fs.readdirSync(srcDir)) {
        if (filter && !filter(name)) continue;
        const src = path.join(srcDir, name);
        if (!fs.statSync(src).isFile()) continue;
        fs.copyFileSync(src, path.join(destDir, name));
    }
    console.log('[copy-static] copied', srcDir, '->', destDir);
}

const root = path.join(__dirname, '..', 'static');

copyDirFiles(
    path.join(root, 'crowdfunding-data'),
    path.join(root, '..', 'public', 'crowdfunding-data'),
    name => name.endsWith('.json')
);

copyDirFiles(
    path.join(root, 'image'),
    path.join(root, '..', 'public', 'image'),
    name => /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
);
