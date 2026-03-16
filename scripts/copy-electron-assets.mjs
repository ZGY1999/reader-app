import { mkdir, copyFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const copyTargets = [
  {
    source: path.join(projectRoot, 'src', 'database', 'schema.sql'),
    destination: path.join(projectRoot, 'dist', 'database', 'schema.sql'),
  },
];

for (const target of copyTargets) {
  await mkdir(path.dirname(target.destination), { recursive: true });
  await copyFile(target.source, target.destination);
}
