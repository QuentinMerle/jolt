import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface InboxPayload {
  id?: string;
  timestamp?: number;
  note?: string;
  [key: string]: unknown;
}

function getDefaultInboxPath(argv: string[] = process.argv): string {
  const idx = argv.indexOf('--inbox');
  if (idx !== -1 && argv[idx + 1]) {
    return path.resolve(argv[idx + 1]);
  }
  return path.join(process.cwd(), '.jolt', 'inbox.json');
}

function readInboxSafe(inboxPath: string): InboxPayload | null {
  try {
    if (!fs.existsSync(inboxPath)) return null;
    const raw = fs.readFileSync(inboxPath, 'utf8').trim();
    if (!raw) return null;
    return JSON.parse(raw) as InboxPayload;
  } catch {
    return null;
  }
}

function writeOutboxSafe(outboxPath: string, payload: Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(outboxPath), { recursive: true });
    fs.writeFileSync(outboxPath, JSON.stringify(payload), 'utf8');
  } catch {
    // Ignore outbox write error if workspace is restricted.
  }
}

/**
 * Starts Jolt's active front-end listener loop:
 * 1) Publishes `status: "listening"` into `.jolt/outbox.json` so `<jolt-hud>` shows LIVE + Stop button.
 * 2) Resolves on the next new pin in `.jolt/inbox.json`.
 * 3) Cleanly releases the HUD (`done`) and returns `{ stoppedByUser: true }` on `[STOP_LIVE]`.
 */
export function startWaitForPinLoop(inboxPathOverride?: string): void {
  const inboxPath = inboxPathOverride ? path.resolve(inboxPathOverride) : getDefaultInboxPath();
  const outboxPath = path.join(path.dirname(inboxPath), 'outbox.json');
  const initial = readInboxSafe(inboxPath);
  const baselineId = initial?.id ?? null;
  const baselineTs = typeof initial?.timestamp === 'number' ? initial.timestamp : Date.now();

  writeOutboxSafe(outboxPath, {
    id: `listen_${Date.now().toString(36)}`,
    status: 'listening',
    message: 'Listening · Alt+Click or Stop',
  });

  const pollTimer = setInterval(() => {
    const current = readInboxSafe(inboxPath);
    if (!current) return;

    const isNewerId = current.id && current.id !== baselineId;
    const isNewerTime = typeof current.timestamp === 'number' && current.timestamp > baselineTs;

    if (isNewerId && isNewerTime) {
      clearInterval(pollTimer);
      if (current.note === '[STOP_LIVE]') {
        writeOutboxSafe(outboxPath, {
          id: `stop_${current.id}`,
          status: 'done',
          message: 'Listening stopped — control returned',
        });
        process.stdout.write(`${JSON.stringify({ ...current, stoppedByUser: true }, null, 2)}\n`);
      } else {
        const targetTag = (current.target as { tag?: string } | undefined)?.tag || 'target';
        writeOutboxSafe(outboxPath, {
          id: `ack_${current.id}`,
          status: 'working',
          message: `Analyzing ${targetTag}…`,
        });
        process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
      }
      process.exit(0);
    }
  }, 150);
}

function isExecutedAsMain(filePath: string): boolean {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(filePath);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(filePath);
  }
}

const THIS_FILE = fileURLToPath(import.meta.url);
const isMain = isExecutedAsMain(THIS_FILE);
if (isMain) {
  startWaitForPinLoop();
}
