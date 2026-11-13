const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'nodes', 'Raidboxes', 'raidboxes.svg');
const dst = path.join(__dirname, '..', 'dist', 'nodes', 'Raidboxes', 'raidboxes.svg');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
