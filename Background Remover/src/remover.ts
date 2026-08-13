import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import type { SubjectMode } from './formats';

/** Lets an engine report what it is doing to the spinner. */
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

/** Exit code the Swift helper uses for "this image has no subject to cut out". */
export const NO_SUBJECT_EXIT = 5;

/** Thrown when the helper reports that it found nothing to extract. */
export class NoSubjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoSubjectError';
  }
}

const HELPER_NAME = 'bgremove';

function cacheDir(): string {
  return path.join(os.homedir(), 'Library', 'Caches', 'my_bg_remover');
}

/** Locations the Swift source might live in, prebuilt install first. */
function sourceCandidates(): string[] {
  return [
    path.join(__dirname, 'swift', `${HELPER_NAME}.swift`),
    path.join(__dirname, '..', 'src', 'swift', `${HELPER_NAME}.swift`),
  ];
}

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the Swift helper, compiling it on demand when needed.
 *
 * `npm run build` produces dist/bin/bgremove, so the common path is a plain
 * existence check. The lazy compile exists for `npm run dev`, where tsc never
 * ran, and it caches by source mtime so editing the Swift triggers a rebuild.
 */
export function ensureHelper(): string {
  const prebuilt = path.join(__dirname, 'bin', HELPER_NAME);
  if (isExecutable(prebuilt)) return prebuilt;

  const source = sourceCandidates().find((candidate) => fs.existsSync(candidate));
  if (!source) {
    throw new Error(`cannot find ${HELPER_NAME}.swift — reinstall the package`);
  }

  const stamp = Math.floor(fs.statSync(source).mtimeMs).toString(36);
  const compiled = path.join(cacheDir(), `${HELPER_NAME}-${stamp}`);
  if (isExecutable(compiled)) return compiled;

  const swiftc = resolveCommand('swiftc');
  if (!swiftc) {
    throw new Error(
      'swiftc not found — install the Xcode Command Line Tools with: xcode-select --install'
    );
  }

  fs.mkdirSync(cacheDir(), { recursive: true });
  try {
    execFileSync(swiftc, ['-O', source, '-o', compiled], { stdio: 'pipe' });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`could not compile ${HELPER_NAME}.swift: ${stderr || 'unknown error'}`);
  }

  return compiled;
}

/**
 * Runs the Vision helper. Throws NoSubjectError when the image simply has no
 * foreground, so the caller can count it as a skip rather than a failure.
 */
export function removeBackground(
  helper: string,
  inputPath: string,
  outputPath: string,
  subjectMode: SubjectMode,
  onProgress: ProgressReporter = () => {}
): void {
  onProgress(subjectMode === 'largest' ? 'finding the main subject' : 'detecting subjects');
  try {
    execFileSync(helper, [inputPath, outputPath, subjectMode], { stdio: 'pipe' });
  } catch (error) {
    const failure = error as { status?: number; stderr?: Buffer };
    const reason = failure.stderr?.toString().trim().split('\n')[0] || 'vision helper failed';
    if (failure.status === NO_SUBJECT_EXIT) throw new NoSubjectError(reason);
    throw new Error(reason);
  }
}

/**
 * Flattens a cut-out onto a solid colour. Writes via a temp file because sharp
 * cannot read and write the same path in one pipeline.
 */
export async function flattenOnto(
  filePath: string,
  background: string,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  onProgress(`flattening onto ${background}`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-remover-'));
  try {
    const staged = path.join(tempDir, 'flattened.png');
    await sharp(filePath).flatten({ background }).png().toFile(staged);
    fs.copyFileSync(staged, filePath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * True when an image already has a real alpha channel with transparent pixels.
 * Re-cutting one of our own outputs is wasted work, so those get skipped.
 */
export async function isAlreadyTransparent(filePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filePath).metadata();
    if (!metadata.hasAlpha) return false;
    const stats = await sharp(filePath).stats();
    return !stats.isOpaque;
  } catch {
    // Unreadable by sharp (HEIC on some builds) — let Vision have a go at it.
    return false;
  }
}
