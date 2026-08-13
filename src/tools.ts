import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * Directories checked when a command is not on PATH. Launchd, Automator and
 * Shortcuts start processes with a bare PATH, so Homebrew and nvm-installed
 * binaries are invisible unless we look for them ourselves.
 */
const EXTRA_BIN_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(os.homedir(), '.cargo', 'bin'),
];

const commandCache = new Map<string, string | null>();

/** Resolves a command to an absolute path, or null if it is not installed. */
export function resolveCommand(command: string): string | null {
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

export interface Tool {
  /** Short name typed as the first argument: `my_media_automations bg ~/Pictures`. */
  alias: string;
  /** The command name, used only if the tool also happens to be linked globally. */
  command: string;
  label: string;
  summary: string;
  /** Folder name beside this launcher. */
  project: string;
}

/**
 * Every tool the launcher knows about.
 *
 * The individual tools are deliberately not linked into the global npm bin —
 * this launcher is the single entry point — so they are found on disk rather
 * than on PATH.
 */
export const TOOLS: Tool[] = [
  {
    alias: 'image',
    command: 'my_image_converter',
    label: 'Image Converter',
    summary: 'images to png / jpeg / webp / svg, video to mp4',
    project: 'Image Converter',
  },
  {
    alias: 'bg',
    command: 'my_bg_remover',
    label: 'Background Remover',
    summary: 'strip image backgrounds with macOS Vision',
    project: 'Background Remover',
  },
  {
    alias: 'convert',
    command: 'my_file_converter',
    label: 'File Converter',
    summary: 'md / docx / html / pdf, csv / json / yaml / xlsx, gif, mp3',
    project: 'File Converter',
  },
  {
    alias: 'compress',
    command: 'my_media_compressor',
    label: 'Media Compressor',
    summary: 'shrink images and video: normal, super, ultra',
    project: 'Media Compressor',
  },
];

export interface ResolvedTool extends Tool {
  /** Where the tool's project lives, or null if that folder is gone. */
  projectDir: string | null;
  /** Argv to run it with, or null when it cannot be run yet. */
  argv: string[] | null;
  /** Set when the project is present but has not been built. */
  needsBuild: boolean;
}

/**
 * Each tool's project directory.
 *
 * Derived from where this launcher is installed rather than from the working
 * directory, so it stays correct however the repo is arranged or renamed.
 */
function projectDirFor(tool: Tool): string | null {
  const candidates = [
    path.join(__dirname, '..', tool.project),
    path.join(__dirname, '..', '..', tool.project),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'package.json'))) ?? null;
}

/**
 * How to start a tool.
 *
 * Preference is the compiled entry point in its own project, run with the same
 * node that is running this launcher. A globally linked command is accepted as
 * a fallback, so an older setup that still has them on PATH keeps working.
 */
function argvFor(tool: Tool, projectDir: string | null): string[] | null {
  if (projectDir) {
    const entry = path.join(projectDir, 'dist', 'index.js');
    if (fs.existsSync(entry)) return [process.execPath, entry];
  }
  const linked = resolveCommand(tool.command);
  return linked ? [linked] : null;
}

/**
 * The registry with each entry's state filled in.
 *
 * A tool that is neither present on disk nor on PATH is dropped: it has been
 * deleted, and offering to run something that no longer exists is worse than
 * not mentioning it.
 */
export function resolveTools(): ResolvedTool[] {
  return TOOLS.map((tool) => {
    const projectDir = projectDirFor(tool);
    const argv = argvFor(tool, projectDir);
    return {
      ...tool,
      projectDir,
      argv,
      needsBuild: argv === null && projectDir !== null,
    };
  }).filter((tool) => tool.argv !== null || tool.projectDir !== null);
}

export function findByAlias(alias: string): ResolvedTool | undefined {
  const wanted = alias.toLowerCase();
  return resolveTools().find((tool) => tool.alias === wanted || tool.command === wanted);
}

/** What to tell the user when a tool cannot be started. */
export function buildHint(tool: ResolvedTool): string {
  if (!tool.projectDir) {
    return `${tool.label} is unavailable and its project folder is missing.`;
  }
  return [
    `${tool.label} has not been built yet. To fix it:`,
    '',
    `  cd "${tool.projectDir}"`,
    '  npm install && npm run build',
  ].join('\n');
}

/** Build commands for every known tool, for the "nothing works yet" message. */
export function allBuildHints(): string[] {
  return resolveTools()
    .filter((tool) => tool.projectDir)
    .map((tool) => `  cd "${tool.projectDir}" && npm install && npm run build`);
}
