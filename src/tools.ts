import fs from 'fs';
import path from 'path';

export interface Tool {
  /** Short name typed as the first argument: `auto bg ~/Pictures`. */
  alias: string;
  label: string;
  summary: string;
  /** Folder under src/ (and therefore dist/) holding this tool's entry point. */
  dir: string;
}

/**
 * Every tool in this package.
 *
 * They ship together as one install, but each keeps its own entry point and is
 * started as a child process: they were written as standalone CLIs that read
 * process.argv and exit when done, and running them that way keeps that
 * contract intact instead of unpicking it.
 */
export const TOOLS: Tool[] = [
  {
    alias: 'image',
    label: 'Image Converter',
    summary: 'images to png / jpeg / webp / svg, video to mp4',
    dir: 'image',
  },
  {
    alias: 'bg',
    label: 'Background Remover',
    summary: 'strip image backgrounds with macOS Vision',
    dir: 'bg',
  },
  {
    alias: 'convert',
    label: 'File Converter',
    summary: 'md / docx / html / pdf, csv / json / yaml / xlsx, gif, mp3',
    dir: 'convert',
  },
  {
    alias: 'compress',
    label: 'Media Compressor',
    summary: 'shrink images and video: normal, super, ultra',
    dir: 'compress',
  },
];

export interface ResolvedTool extends Tool {
  /** Argv to run it with, or null when its entry point is missing. */
  argv: string[] | null;
}

/**
 * How to start a tool.
 *
 * Run with the same node executing this launcher, so there is nothing to find
 * on PATH and no dependency on how the package was installed. Under ts-node
 * the entry is still .ts, which is what lets `npm run dev` work unbuilt.
 */
function argvFor(tool: Tool): string[] | null {
  const extension = path.extname(__filename) === '.ts' ? '.ts' : '.js';
  const entry = path.join(__dirname, tool.dir, `index${extension}`);
  if (!fs.existsSync(entry)) return null;

  // ts-node has to stay in the loop for a .ts entry point.
  const loader = extension === '.ts' ? ['-r', 'ts-node/register'] : [];
  return [process.execPath, ...loader, entry];
}

export function resolveTools(): ResolvedTool[] {
  return TOOLS.map((tool) => ({ ...tool, argv: argvFor(tool) }));
}

export function findByAlias(alias: string): ResolvedTool | undefined {
  const wanted = alias.toLowerCase();
  return resolveTools().find((tool) => tool.alias === wanted);
}

/** What to tell the user when a tool's entry point is not there. */
export function buildHint(tool: ResolvedTool): string {
  return [
    `${tool.label} is missing its entry point.`,
    '',
    'The package looks half-built. From the package root:',
    '  npm install && npm run build',
  ].join('\n');
}

/** Shown when nothing at all can be run. */
export function allBuildHints(): string[] {
  return ['  npm install && npm run build'];
}
