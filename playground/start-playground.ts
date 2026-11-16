import path from 'node:path';
import { startStandaloneDevServer } from '../src/server/standalone-dev-server.ts';

const port = process.env.JOLT_PORT ? Number(process.env.JOLT_PORT) : 5173;
const playgroundDir = path.resolve(import.meta.dirname);
const projectRoot = path.resolve(playgroundDir, '..');

const instance = await startStandaloneDevServer({
  staticDir: playgroundDir,
  rootDir: projectRoot,
  port,
  host: '127.0.0.1',
});

process.stdout.write(`Jolt ⚡ Playground running at ${instance.url}\n`);
process.stdout.write(`Endpoints: ${instance.url}/__jolt/digest | ${instance.url}/@jolt/probe.js\n`);

const shutdown = async () => {
  await instance.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
