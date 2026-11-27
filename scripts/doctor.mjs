import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Node.js 22+ required; Node.js 22 LTS is tested.'); process.exit(1);
}
if (!existsSync(path.join(root, 'node_modules/next/package.json'))) {
  console.error('Web packages missing. Run npm ci --legacy-peer-deps.'); process.exit(1);
}
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  console.error(process.platform === 'win32' ? 'Python environment missing. Run ./scripts/setup.ps1.' : 'Python environment missing. Run bash scripts/setup.sh.'); process.exit(1);
}
const result = spawnSync(python, ['scripts/doctor.py', ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit', windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
