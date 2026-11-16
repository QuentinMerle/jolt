import path from 'node:path';
import { JOLT_HUD_TAG, JOLT_LOC_ATTR } from '../shared/constants.ts';

const SUPPORTED_EXT_RE = /\.(html|htm|jsx|tsx|vue|svelte)$/i;

const TRACKED_HTML_TAGS = new Set([
  'a', 'article', 'aside', 'audio', 'button', 'canvas', 'code', 'details',
  'dialog', 'div', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'img', 'input', 'label',
  'li', 'main', 'nav', 'ol', 'option', 'p', 'pre', 'section', 'select',
  'span', 'summary', 'table', 'tbody', 'td', 'textarea', 'th', 'thead',
  'tr', 'ul', 'video',
]);

/** Builds an array of character offsets where each 1-based line starts. */
function computeLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** Resolves 1-based { line, column } for a 0-based character offset. */
function offsetToLineCol(lineStarts: readonly number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineStarts[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const lineIdx = Math.max(0, high);
  return {
    line: lineIdx + 1,
    column: offset - lineStarts[lineIdx] + 1,
  };
}

/** Finds the closing `>` of an opening tag starting right after `<tagName`, respecting quotes and `{...}` expressions. */
function findTagEnd(source: string, startIdx: number, isJsxLike: boolean): number {
  let quote: string | null = null;
  let braceDepth = 0;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || (isJsxLike && ch === '`')) {
      quote = ch;
      continue;
    }

    if (isJsxLike) {
      if (ch === '{') {
        braceDepth++;
        continue;
      }
      if (ch === '}' && braceDepth > 0) {
        braceDepth--;
        continue;
      }
    }

    if (ch === '>' && braceDepth === 0) {
      return i;
    }
  }
  return -1;
}

/** Collects index intervals `[start, end)` that must never be rewritten (comments, script/style bodies). */
function computeExcludedRanges(source: string, ext: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const isHtml = ext === '.html' || ext === '.htm';
  const isMarkup = isHtml || ext === '.vue' || ext === '.svelte';

  if (isMarkup) {
    const blockRe = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi;
    let match: RegExpExecArray | null;
    while ((match = blockRe.exec(source)) !== null) {
      ranges.push([match.index, match.index + match[0].length]);
    }
    return ranges;
  }

  // For JSX/TSX, skip quoted literals and JS comments so tags inside strings/comments stay untouched.
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      ranges.push([i, stop]);
      i = stop;
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      ranges.push([i, stop]);
      i = stop - 1;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i;
      let closed = false;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (quote !== '`' && source[i] === '\n') {
          break;
        }
        if (source[i] === quote) {
          closed = true;
          break;
        }
        i++;
      }
      if (closed) {
        ranges.push([start, Math.min(source.length, i + 1)]);
      } else {
        // Unclosed quote on a single line (e.g. apostrophe in JSX text like "It's")
        i = start;
      }
    }
  }

  return ranges;
}

function isInRanges(offset: number, ranges: readonly Array<[number, number]>): boolean {
  for (const [start, end] of ranges) {
    if (offset >= start && offset < end) {
      return true;
    }
    if (start > offset) {
      break;
    }
  }
  return false;
}

/**
 * Annotates HTML, Vue, Svelte, and JSX/TSX opening tags with `data-jolt-loc="file:line:col"`
 * during dev-serve so click events, Alt+Click inspections, and errors map directly to source code.
 */
export function injectSourceLocations(
  code: string,
  filePath: string,
  rootDir = process.cwd(),
): string {
  if (!code || filePath.includes('node_modules') || filePath.startsWith('\0')) {
    return code;
  }

  const cleanPath = filePath.split('?')[0];
  const extMatch = SUPPORTED_EXT_RE.exec(cleanPath);
  if (!extMatch) {
    return code;
  }

  const ext = `.${extMatch[1].toLowerCase()}`;
  const isJsxLike = ext === '.jsx' || ext === '.tsx';
  const relPath = path.relative(rootDir, cleanPath).split(path.sep).join('/') || path.basename(cleanPath);

  const lineStarts = computeLineStarts(code);
  const excluded = computeExcludedRanges(code, ext);

  const edits: Array<{ pos: number; text: string }> = [];
  const openTagRe = /<([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>])/g;
  let match: RegExpExecArray | null;

  while ((match = openTagRe.exec(code)) !== null) {
    const startIdx = match.index;
    const tagName = match[1].toLowerCase();

    if (tagName === JOLT_HUD_TAG || !TRACKED_HTML_TAGS.has(tagName)) {
      continue;
    }
    if (isInRanges(startIdx, excluded)) {
      continue;
    }

    // Avoid matching TS generics such as `foo<button>` or comparisons.
    if (startIdx > 0 && /[a-zA-Z0-9_$.]/.test(code[startIdx - 1])) {
      continue;
    }

    const afterTagName = startIdx + 1 + match[1].length;
    const tagEnd = findTagEnd(code, afterTagName, isJsxLike);
    if (tagEnd === -1) {
      continue;
    }

    const tagSlice = code.slice(startIdx, tagEnd + 1);
    if (tagSlice.includes(JOLT_LOC_ATTR)) {
      continue;
    }

    const { line, column } = offsetToLineCol(lineStarts, startIdx);
    const attrText = ` ${JOLT_LOC_ATTR}="${relPath}:${line}:${column}"`;

    // Insert just before `/>` or `>` to preserve existing attribute formatting.
    const insertPos = tagEnd > afterTagName && code[tagEnd - 1] === '/' ? tagEnd - 1 : tagEnd;
    edits.push({ pos: insertPos, text: attrText });
  }

  if (edits.length === 0) {
    return code;
  }

  let output = '';
  let cursor = 0;
  for (const edit of edits) {
    output += code.slice(cursor, edit.pos) + edit.text;
    cursor = edit.pos;
  }
  output += code.slice(cursor);
  return output;
}
