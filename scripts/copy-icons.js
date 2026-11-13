const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'nodes', 'Raidboxes');
const out = path.join(__dirname, '..', 'dist', 'nodes', 'Raidboxes');
fs.mkdirSync(out, { recursive: true });
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
	fs.copyFileSync(path.join(dir, file), path.join(out, file));
}
