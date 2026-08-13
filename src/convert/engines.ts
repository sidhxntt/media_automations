import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { marked } from 'marked';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import Papa from 'papaparse';
import * as YAML from 'yaml';
import ExcelJS from 'exceljs';
import { markdownToDocxBuffer } from './docx-renderer';
import type { Source, Target } from './formats';

/** Lets an engine report what it is doing, and how far along, to the spinner. */
export type ProgressReporter = (stage: string, percent?: number) => void;

/**
 * Directories checked when a command is not on PATH. Launchd, Automator and
 * Shortcuts start processes with a bare PATH, so Homebrew and cargo binaries
 * are invisible unless we look for them ourselves.
 */
const EXTRA_BIN_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.cargo', 'bin'),
];

const commandCache = new Map<string, string | null>();

/** Resolves a command to an absolute path, or null if it is not installed. */
function resolveCommand(command: string): string | null {
  const cached = commandCache.get(command);
  if (cached !== undefined) return cached;

  let resolved: string | null = null;
  try {
    const found = execFileSync('/usr/bin/which', [command], { stdio: 'pipe' })
      .toString()
      .trim()
      .split('\n')[0];
    if (found) resolved = found;
  } catch {
    // Not on PATH — fall through to the well-known install directories.
  }

  if (!resolved) {
    for (const dir of EXTRA_BIN_DIRS) {
      const candidate = path.join(dir, command);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        resolved = candidate;
        break;
      } catch {
        // Keep looking.
      }
    }
  }

  commandCache.set(command, resolved);
  return resolved;
}

/** Returns true if a command is installed. Result is cached. */
export function hasCommand(command: string): boolean {
  return resolveCommand(command) !== null;
}

function run(command: string, args: string[]): void {
  const binary = resolveCommand(command);
  if (!binary) throw new Error(`${command} is not installed`);
  try {
    execFileSync(binary, args, { stdio: 'pipe' });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(stderr ? stderr.split('\n').slice(-1)[0] : `${command} failed`);
  }
}

// --- Swift PDF helper -------------------------------------------------------

const HELPER_NAME = 'html2pdf';

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the WKWebView PDF helper, compiling it on demand.
 *
 * `npm run build` produces dist/bin/html2pdf. The lazy compile covers
 * `npm run dev`, where tsc never ran, cached by source mtime.
 */
export function ensurePdfHelper(): string {
  const prebuilt = path.join(__dirname, 'bin', HELPER_NAME);
  if (isExecutable(prebuilt)) return prebuilt;

  const candidates = [
    path.join(__dirname, 'swift', `${HELPER_NAME}.swift`),
    path.join(__dirname, '..', 'src', 'swift', `${HELPER_NAME}.swift`),
  ];
  const source = candidates.find((candidate) => fs.existsSync(candidate));
  if (!source) throw new Error(`cannot find ${HELPER_NAME}.swift — reinstall the package`);

  const cacheDir = path.join(os.homedir(), 'Library', 'Caches', 'my_file_converter');
  const stamp = Math.floor(fs.statSync(source).mtimeMs).toString(36);
  const compiled = path.join(cacheDir, `${HELPER_NAME}-${stamp}`);
  if (isExecutable(compiled)) return compiled;

  const swiftc = resolveCommand('swiftc');
  if (!swiftc) {
    throw new Error(
      'swiftc not found — install the Xcode Command Line Tools with: xcode-select --install'
    );
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  try {
    execFileSync(swiftc, ['-O', source, '-o', compiled], { stdio: 'pipe' });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`could not compile ${HELPER_NAME}.swift: ${stderr || 'unknown error'}`);
  }

  return compiled;
}

/** Reports whether a Chrome-family binary is available as a PDF fallback. */
function chromeCommand(): string | null {
  for (const candidate of ['google-chrome', 'chromium', 'chrome']) {
    if (hasCommand(candidate)) return candidate;
  }
  return null;
}

/**
 * An A4 reference document for pandoc.
 *
 * pandoc copies page setup and styles from a reference docx, and its built-in
 * default is US Letter. Handing it one produced by our own renderer is what
 * keeps every route to .docx on the same A4 page with the same margins.
 * Cached, since generating it costs a document build.
 */
let cachedReferenceDoc: string | null = null;

async function a4ReferenceDoc(): Promise<string> {
  if (cachedReferenceDoc && fs.existsSync(cachedReferenceDoc)) return cachedReferenceDoc;

  const dir = path.join(os.homedir(), 'Library', 'Caches', 'my_file_converter');
  fs.mkdirSync(dir, { recursive: true });
  const reference = path.join(dir, 'a4-reference.docx');
  fs.writeFileSync(reference, await markdownToDocxBuffer('# Reference\n\nBody.\n'));
  cachedReferenceDoc = reference;
  return reference;
}

// --- Documents --------------------------------------------------------------

/** Wraps rendered HTML in a styled document so PDFs are not unstyled Times. */
function htmlDocument(body: string, title: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  /* A4 with 2cm margins, matching the docx renderer. The printer owns the
     margins, so the body adds none of its own. */
  @page { size: A4; margin: 2cm; }

  body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
         line-height: 1.6; color: #0f172a; margin: 0; padding: 0;
         -webkit-text-size-adjust: none; font-size: 11pt; }

  /* The heading scale is the document's structure, so keep the steps clearly
     distinct rather than letting h2 and h3 collapse into each other. */
  h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.4em 0 0.5em; font-weight: 600; }
  h1 { font-size: 2em; margin-top: 0; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.22em; }
  h4 { font-size: 1.06em; }
  h5 { font-size: 1em; }
  h6 { font-size: 0.92em; color: #475569; }

  code, pre { font-family: Menlo, monospace; font-size: 0.88em; }
  code { background: #f1f5f9; padding: 0.15em 0.35em; border-radius: 3px; }
  pre { background: #f1f5f9; padding: 1em; border-radius: 6px; white-space: pre-wrap;
        word-wrap: break-word; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #cbd5e1; color: #475569; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #cbd5e1; padding: 0.45em 0.7em; text-align: left;
           vertical-align: top; }
  th { background: #f1f5f9; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.5em 0; }

  /* Pagination. Without these a heading strands at the foot of a page and
     tables and code blocks get sliced across the break. */
  h1, h2, h3, h4, h5, h6 { break-after: avoid-page; page-break-after: avoid; }
  pre, blockquote, table, figure { break-inside: avoid; page-break-inside: avoid; }
  tr, li { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  p { orphans: 3; widows: 3; }
</style></head><body>
${body}
</body></html>`;
}

export function markdownToHtml(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter = () => {}
): void {
  onProgress('rendering html');
  const markdown = fs.readFileSync(inputPath, 'utf8');
  const body = marked.parse(markdown, { async: false }) as string;
  fs.writeFileSync(outputPath, htmlDocument(body, path.parse(inputPath).name));
}

/**
 * Recovers code from the named styles our own markdown-to-docx writes.
 *
 * mammoth only sees a monospace font otherwise, which is indistinguishable
 * from prose. `separator('\n')` merges the run of one-line paragraphs a code
 * block was split into back into a single <pre>.
 */
const MAMMOTH_STYLE_MAP = [
  // Our own renderer's names.
  "p[style-name='Code'] => pre:separator('\\n')",
  "r[style-name='CodeChar'] => code",
  // Code blocks in a pandoc-written docx, so those round-trip too. Its inline
  // code cannot be recovered: pandoc tags it with a style that has no display
  // name, and mammoth can only select on names.
  "p[style-name='Source Code'] => pre:separator('\\n')",
];

function readDocx(inputPath: string): Promise<{ value: string }> {
  return mammoth.convertToHtml({ path: inputPath }, { styleMap: MAMMOTH_STYLE_MAP });
}

export async function docxToHtml(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  onProgress('reading docx');
  const { value } = await readDocx(inputPath);
  fs.writeFileSync(outputPath, htmlDocument(value, path.parse(inputPath).name));
}

function turndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // mammoth emits a bare <pre> for code, but turndown's fenced-block rule only
  // fires on <pre><code>. Without this the block degrades into paragraphs with
  // every underscore backslash-escaped.
  service.addRule('barePre', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_content, node) => {
      const text = (node.textContent ?? '').replace(/\n$/, '');
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    },
  });

  // A markdown code span cannot contain markup, so bold or italics inside one
  // has to be dropped rather than emitted as literal ** characters. Backtick
  // runs in the content are fenced with a longer run, per CommonMark.
  service.addRule('inlineCode', {
    filter: (node) => node.nodeName === 'CODE' && node.parentNode?.nodeName !== 'PRE',
    replacement: (_content, node) => {
      const text = (node.textContent ?? '').replace(/\r?\n/g, ' ');
      if (!text) return '';
      const longestRun = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
      const fence = '`'.repeat(longestRun + 1);
      const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
      return `${fence}${pad}${text}${pad}${fence}`;
    },
  });

  // Turndown has no table support out of the box, and tables are the most
  // visible thing lost in a docx round trip. Emit GFM pipe tables instead of
  // leaving raw HTML in the markdown.
  // Cells are converted rather than flattened with textContent, so bold, code
  // and links inside a cell survive. A row has to be one line, so any newlines
  // the conversion produces are collapsed and pipes escaped.
  const cellMarkdown = (cell: Element): string => {
    const markdown = service
      .turndown((cell as unknown as { innerHTML?: string }).innerHTML ?? cell.textContent ?? '')
      .replace(/\s*\r?\n+\s*/g, ' ')
      .replace(/\|/g, '\\|')
      .trim();

    // A GFM header row renders bold already, so the bold a docx header cell
    // carries would come back as redundant ** around every heading.
    if (cell.nodeName === 'TH') {
      // [\s\S] rather than the /s flag, which needs an ES2018 target.
      return markdown.replace(/^\*\*([\s\S]*)\*\*$/, '$1');
    }
    return markdown;
  };

  service.addRule('gfmTable', {
    filter: 'table',
    replacement: (_content, node) => {
      const rows = Array.from((node as Element).querySelectorAll('tr'));
      if (rows.length === 0) return '';

      const grid = rows.map((row) =>
        Array.from(row.querySelectorAll('th, td')).map((cell) => cellMarkdown(cell as Element))
      );
      const width = Math.max(...grid.map((row) => row.length));
      const pad = (row: string[]) =>
        `| ${[...row, ...Array(width - row.length).fill('')].join(' | ')} |`;

      const [header, ...body] = grid;
      const divider = `| ${Array(width).fill('---').join(' | ')} |`;
      return `\n\n${[pad(header), divider, ...body.map(pad)].join('\n')}\n\n`;
    },
  });

  return service;
}

export async function docxToMarkdown(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  // mammoth rather than pandoc, even when pandoc is installed: the style map
  // below is what recovers fenced code blocks, and routing through pandoc
  // would silently lose them.
  onProgress('reading docx');
  const { value } = await readDocx(inputPath);
  onProgress('converting to markdown');
  fs.writeFileSync(outputPath, turndown().turndown(value));
}

export function htmlToMarkdown(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter = () => {}
): void {
  onProgress('converting to markdown');
  const html = fs.readFileSync(inputPath, 'utf8');
  fs.writeFileSync(outputPath, turndown().turndown(html));
}

/**
 * Markdown to .docx. Prefers pandoc for fidelity when it happens to be
 * installed, and otherwise uses the built-in renderer so the common path never
 * requires a Homebrew package.
 */
export async function markdownToDocx(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  // Deliberately not pandoc, even when it is installed. The built-in renderer
  // is the only one that writes the Code and CodeChar styles that let a docx
  // convert back to markdown with its fenced blocks and backticks intact —
  // pandoc marks inline code with a style carrying no name, which nothing
  // downstream can match on. It also owns the A4 page setup directly.
  onProgress('rendering docx');
  const markdown = fs.readFileSync(inputPath, 'utf8');
  fs.writeFileSync(outputPath, await markdownToDocxBuffer(markdown));
}

export async function htmlToDocx(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  onProgress('rendering docx');
  if (hasCommand('pandoc')) {
    run('pandoc', ['-f', 'html', '-t', 'docx',
                   `--reference-doc=${await a4ReferenceDoc()}`,
                   '-o', outputPath, inputPath]);
    return;
  }
  // No direct HTML to docx in the JS stack, so go through markdown. Lossy for
  // exotic markup, fine for documents that started as prose.
  const html = fs.readFileSync(inputPath, 'utf8');
  fs.writeFileSync(outputPath, await markdownToDocxBuffer(turndown().turndown(html)));
}

/** Renders HTML to PDF with WKWebView, falling back to headless Chrome. */
export function htmlFileToPdf(helper: string, inputPath: string, outputPath: string): void {
  try {
    execFileSync(helper, [inputPath, outputPath], { stdio: 'pipe' });
    return;
  } catch (error) {
    const reason =
      (error as { stderr?: Buffer }).stderr?.toString().trim().split('\n')[0] ?? 'webkit failed';
    const chrome = chromeCommand();
    if (!chrome) throw new Error(reason);
    run(chrome, [
      '--headless',
      '--disable-gpu',
      `--print-to-pdf=${outputPath}`,
      '--no-pdf-header-footer',
      `file://${inputPath}`,
    ]);
  }
}

/** Any document to PDF, staging through HTML in a temp dir. */
export async function documentToPdf(
  helper: string,
  inputPath: string,
  outputPath: string,
  source: Source,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  if (source === 'html' || source === 'htm') {
    onProgress('printing with WebKit');
    htmlFileToPdf(helper, inputPath, outputPath);
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-converter-'));
  try {
    const staged = path.join(dir, 'staged.html');
    if (source === 'md' || source === 'markdown') {
      markdownToHtml(inputPath, staged, onProgress);
    } else {
      await docxToHtml(inputPath, staged, onProgress);
    }
    onProgress('printing with WebKit');
    htmlFileToPdf(helper, staged, outputPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- Data files -------------------------------------------------------------

type Row = Record<string, unknown>;

/** Reads any supported data file into a common array-of-objects shape. */
async function readRows(inputPath: string, source: Source): Promise<Row[]> {
  if (source === 'csv') {
    const parsed = Papa.parse<Row>(fs.readFileSync(inputPath, 'utf8').trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    return parsed.data;
  }

  if (source === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(inputPath);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('workbook has no sheets');

    const headerRow = sheet.getRow(1);
    const headers = (headerRow.values as unknown[]).slice(1).map((value, index) =>
      value === null || value === undefined || value === '' ? `column${index + 1}` : String(value)
    );

    const rows: Row[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as unknown[]).slice(1);
      const record: Row = {};
      headers.forEach((header, index) => {
        const cell = values[index];
        // ExcelJS returns rich objects for formulas and hyperlinks.
        record[header] =
          cell && typeof cell === 'object' && 'result' in (cell as object)
            ? (cell as { result: unknown }).result
            : cell && typeof cell === 'object' && 'text' in (cell as object)
              ? (cell as { text: unknown }).text
              : (cell ?? null);
      });
      rows.push(record);
    });
    return rows;
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = source === 'json' ? JSON.parse(raw) : YAML.parse(raw);

  if (Array.isArray(parsed)) return parsed as Row[];
  // A single object, or a wrapper like { items: [...] }, still has to become
  // rows for csv and xlsx to mean anything.
  if (parsed && typeof parsed === 'object') {
    const values = Object.values(parsed as Row);
    const firstArray = values.find((value) => Array.isArray(value));
    if (firstArray) return firstArray as Row[];
    return [parsed as Row];
  }
  throw new Error('file does not contain tabular data');
}

/** Column order across the whole set, since objects may have ragged keys. */
function columnsOf(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row ?? {})) seen.add(key);
  }
  return [...seen];
}

async function writeRows(rows: Row[], outputPath: string, target: Target): Promise<void> {
  if (target === 'json') {
    fs.writeFileSync(outputPath, `${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  if (target === 'yaml') {
    fs.writeFileSync(outputPath, YAML.stringify(rows));
    return;
  }
  if (target === 'csv') {
    fs.writeFileSync(outputPath, `${Papa.unparse(rows, { columns: columnsOf(rows) })}\n`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  const columns = columnsOf(rows);
  sheet.columns = columns.map((header) => ({ header, key: header }));
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  await workbook.xlsx.writeFile(outputPath);
}

/** Counts sheets so the CLI can warn that only the first one is converted. */
export async function sheetCount(inputPath: string): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  return workbook.worksheets.length;
}

export async function convertData(
  inputPath: string,
  outputPath: string,
  source: Source,
  target: Target,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  onProgress(`reading ${source}`);
  const rows = await readRows(inputPath, source);
  if (rows.length === 0) throw new Error('no rows found');
  onProgress(`writing ${rows.length} row(s) as ${target}`);
  await writeRows(rows, outputPath, target);
}

// --- Media ------------------------------------------------------------------

/** Clip length in seconds, so ffmpeg progress can be turned into a percentage. */
export function mediaDuration(inputPath: string): number | null {
  const binary = resolveCommand('ffprobe');
  if (!binary) return null;
  try {
    const seconds = Number(
      execFileSync(
        binary,
        ['-v', 'error', '-show_entries', 'format=duration', '-of',
         'default=noprint_wrappers=1:nokey=1', inputPath],
        { stdio: 'pipe' }
      ).toString().trim()
    );
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

/**
 * Runs ffmpeg, translating its `-progress` stream into percentages so a long
 * encode shows movement rather than an unchanging spinner.
 */
function runFfmpeg(
  args: string[],
  durationSeconds: number | null,
  stage: string,
  onProgress: ProgressReporter
): Promise<void> {
  const binary = resolveCommand('ffmpeg');
  if (!binary) return Promise.reject(new Error('ffmpeg is not installed'));

  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-progress', 'pipe:1', '-nostats', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let buffered = '';

    const consume = (line: string) => {
      const [key, value] = line.split('=');
      if (key !== 'out_time_us' && key !== 'out_time_ms') return;
      if (!durationSeconds) return;
      // Both keys are reported in microseconds despite the _ms name.
      const seconds = Number.parseInt(value, 10) / 1_000_000;
      if (!Number.isFinite(seconds)) return;
      onProgress(stage, Math.min(99, Math.round((seconds / durationSeconds) * 100)));
    };

    child.stdout.on('data', (chunk: Buffer) => {
      buffered += chunk.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) consume(line);
    });
    child.stdout.on('end', () => {
      if (buffered) consume(buffered);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim().split('\n').pop() ?? `exit code ${code}`));
    });
  });
}

export interface GifOptions {
  fps: string;
  width: string;
}

/**
 * Video to GIF. Two passes: build an optimal palette from the clip, then encode
 * against it. A single pass uses the default 216-colour web palette and looks
 * visibly banded.
 */
export async function videoToGif(
  inputPath: string,
  outputPath: string,
  options: GifOptions,
  durationSeconds: number | null = null,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  const scale = options.width === 'original' ? 'scale=iw:-1' : `scale=${options.width}:-1`;
  const filters = `fps=${options.fps},${scale}:flags=lanczos`;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-converter-'));
  try {
    const palette = path.join(dir, 'palette.png');
    await runFfmpeg(
      ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
       '-vf', `${filters},palettegen=stats_mode=diff`, palette],
      durationSeconds,
      'building colour palette',
      onProgress
    );
    await runFfmpeg(
      ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-i', palette,
       '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
       outputPath],
      durationSeconds,
      'encoding gif',
      onProgress
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Anything with an audio track to MP3. */
export async function toMp3(
  inputPath: string,
  outputPath: string,
  durationSeconds: number | null = null,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  await runFfmpeg(
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
     '-vn', '-c:a', 'libmp3lame', '-q:a', '2', outputPath],
    durationSeconds,
    'encoding mp3',
    onProgress
  );
}

/** MP3 back to uncompressed WAV, for editing tools that demand it. */
export async function toWav(
  inputPath: string,
  outputPath: string,
  durationSeconds: number | null = null,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  await runFfmpeg(
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
     '-vn', '-c:a', 'pcm_s16le', outputPath],
    durationSeconds,
    'encoding wav',
    onProgress
  );
}
