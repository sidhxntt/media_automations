import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import sharp from 'sharp';
import type { Preset } from './formats';

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

/** Thrown when re-encoding made the file bigger, so the original is kept. */
export class NotWorthItError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotWorthItError';
  }
}

// --- Images -----------------------------------------------------------------

/**
 * Re-encodes an image in its own format.
 *
 * Changing container is deliberately out of scope — a compressor that silently
 * turns your PNGs into JPEGs is a surprise, and File Converter already handles
 * format changes on request.
 */
export async function compressImage(
  inputPath: string,
  outputPath: string,
  preset: Preset,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  const extension = path.extname(inputPath).toLowerCase();
  let pipeline = sharp(inputPath, { failOn: 'none' }).rotate();

  if (preset.imageMaxEdge) {
    // fit: 'inside' caps the longest edge; withoutEnlargement stops small
    // images being upscaled into a bigger file than they started as.
    pipeline = pipeline.resize({
      width: preset.imageMaxEdge,
      height: preset.imageMaxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const quality = preset.imageQuality;
  onProgress(preset.imageMaxEdge ? 'resizing and encoding' : 'encoding');

  if (extension === '.png') {
    // palette: true is libvips' own quantiser — the single biggest win on
    // screenshots and flat graphics, and it needs no pngquant install.
    await pipeline.png({ compressionLevel: 9, palette: true, quality }).toFile(outputPath);
    return;
  }
  if (extension === '.webp') {
    await pipeline.webp({ quality, effort: 5 }).toFile(outputPath);
    return;
  }
  if (extension === '.avif') {
    await pipeline.avif({ quality }).toFile(outputPath);
    return;
  }
  if (extension === '.tif' || extension === '.tiff') {
    await pipeline.tiff({ quality, compression: 'jpeg' }).toFile(outputPath);
    return;
  }

  await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outputPath);
}

// --- Video ------------------------------------------------------------------

/**
 * Caps the longest edge whichever way the video is oriented.
 *
 * -2 keeps the other side proportional and even, which x264 requires; the
 * conditionals pick which side is being pinned so portrait clips are not
 * stretched into landscape.
 */
function scaleFilter(maxEdge: number): string {
  return (
    `scale='if(gte(iw,ih),min(${maxEdge},iw),-2)':` +
    `'if(lt(iw,ih),min(${maxEdge},ih),-2)'`
  );
}

/**
 * Runs ffmpeg, translating its `-progress` stream into percentages.
 *
 * Re-encoding a long clip takes minutes, and a spinner with no number gives no
 * clue whether it is halfway or barely started.
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

export async function compressVideo(
  inputPath: string,
  outputPath: string,
  preset: Preset,
  durationSeconds: number | null = null,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  const filters: string[] = [];
  if (preset.videoMaxEdge) filters.push(scaleFilter(preset.videoMaxEdge));
  if (preset.maxFps) filters.push(`fps='min(${preset.maxFps},source_fps)'`);

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    ...(filters.length > 0 ? ['-vf', filters.join(',')] : []),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    String(preset.crf),
    // yuv420p is what QuickTime, iOS and every browser agree on.
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    preset.audioBitrate,
    '-movflags',
    '+faststart',
    outputPath,
  ];

  await runFfmpeg(args, durationSeconds, 'encoding H.264', onProgress);
}

/** Reads duration in seconds, used to show progress on long encodes. */
export function videoDuration(inputPath: string): number | null {
  if (!hasCommand('ffprobe')) return null;
  try {
    const binary = resolveCommand('ffprobe') as string;
    const output = execFileSync(
      binary,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputPath,
      ],
      { stdio: 'pipe' }
    )
      .toString()
      .trim();
    const seconds = Number(output);
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}
