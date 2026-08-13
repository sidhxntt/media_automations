import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile, execFileSync, spawn } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import type { ImageTarget, SvgMode } from './formats';

const execFileAsync = promisify(execFile);

/** Called with a short description of the stage currently running. */
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

/**
 * Runs a command without blocking the event loop, so the caller's spinner keeps
 * animating while the work happens.
 */
async function run(command: string, args: string[]): Promise<void> {
  const binary = resolveCommand(command);
  if (!binary) throw new Error(`${command} is not installed`);
  await execFileAsync(binary, args, { maxBuffer: 64 * 1024 * 1024 });
}

function magickCommand(): string | null {
  if (hasCommand('magick')) return 'magick';
  if (hasCommand('convert')) return 'convert';
  return null;
}

/** sips format name for a target extension, or null if sips can't write it. */
function sipsFormat(target: string): string | null {
  switch (target) {
    case 'png':
      return 'png';
    case 'jpg':
    case 'jpeg':
      return 'jpeg';
    case 'tiff':
      return 'tiff';
    case 'bmp':
      return 'bmp';
    default:
      return null;
  }
}

/** Encodes an image sharp can already read into the requested format. */
async function encodeWithSharp(
  inputPath: string,
  outputPath: string,
  target: Exclude<ImageTarget, 'svg'>
): Promise<void> {
  // rotate() with no argument applies the EXIF orientation tag. Without it a
  // portrait phone photo comes out sideways, because sharp keeps the raw pixel
  // order and drops the tag that told viewers to rotate it.
  const pipeline = sharp(inputPath, { failOn: 'none' }).rotate();
  if (target === 'png') {
    await pipeline.png().toFile(outputPath);
  } else if (target === 'webp') {
    await pipeline.webp({ quality: 90 }).toFile(outputPath);
  } else {
    await pipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(outputPath);
  }
}

/** Decodes anything macOS understands (HEIC, RAW, ...) into a temporary PNG. */
async function decodeWithSips(
  inputPath: string,
  tempDir: string
): Promise<string> {
  const staged = path.join(tempDir, 'decoded.png');
  await run('sips', ['-s', 'format', 'png', inputPath, '--out', staged]);
  return staged;
}

/**
 * Raster -> raster, trying each engine in turn:
 *   1. sharp alone — fast, in-process, covers the common web formats.
 *   2. sips decode to PNG, then sharp encode — reads HEIC and camera RAW, and
 *      sharp applies the orientation tag on the way out.
 *   3. sips alone — writes only a few formats, and `sips -s format` carries the
 *      stored pixels across without applying the orientation tag, so a portrait
 *      iPhone photo lands sideways. Last resort before ImageMagick.
 *   4. ImageMagick, if the user happens to have it.
 */
async function convertRaster(
  inputPath: string,
  outputPath: string,
  target: Exclude<ImageTarget, 'svg'>,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  const errors: string[] = [];

  try {
    onProgress(`encoding ${target} with sharp`);
    await encodeWithSharp(inputPath, outputPath, target);
    return;
  } catch (error) {
    errors.push(`sharp: ${(error as Error).message}`);
  }

  if (hasCommand('sips')) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'converter-'));
    try {
      onProgress('decoding with sips');
      const staged = await decodeWithSips(inputPath, tempDir);
      onProgress(`encoding ${target} with sharp`);
      await encodeWithSharp(staged, outputPath, target);
      return;
    } catch (error) {
      errors.push(`sips+sharp: ${(error as Error).message}`);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    const format = sipsFormat(target);
    if (format) {
      try {
        onProgress(`encoding ${target} with sips`);
        await run('sips', [
          '-s',
          'format',
          format,
          '-s',
          'formatOptions',
          '90',
          inputPath,
          '--out',
          outputPath,
        ]);
        return;
      } catch (error) {
        errors.push(`sips: ${(error as Error).message}`);
      }
    }
  }

  const magick = magickCommand();
  if (magick) {
    try {
      onProgress(`encoding ${target} with ${magick}`);
      await run(magick, [inputPath, '-auto-orient', '-quality', '90', outputPath]);
      return;
    } catch (error) {
      errors.push(`${magick}: ${(error as Error).message}`);
    }
  }

  throw new Error(`no converter could read this file (${errors.join(' | ')})`);
}

/**
 * Makes a traced SVG scale to whatever is displaying it.
 *
 * Tracers emit a fixed pixel width and height and no viewBox, so a 4032px photo
 * opens at 4032px and has to be scrolled. Swapping those for a viewBox keeps the
 * aspect ratio and lets browsers, Quick Look and design tools fit it to frame.
 */
function normalizeSvg(svgPath: string): void {
  // Only the header is read. A traced photo can run to hundreds of megabytes,
  // and reading that as a string throws past Node's max string length.
  const HEADER_BYTES = 64 * 1024;
  const handle = fs.openSync(svgPath, 'r');
  let header: string;
  let headerLength: number;
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    headerLength = fs.readSync(handle, buffer, 0, HEADER_BYTES, 0);
    header = buffer.subarray(0, headerLength).toString('utf8');
  } finally {
    fs.closeSync(handle);
  }

  const openTag = header.match(/<svg\b[^>]*>/);
  if (!openTag) return;

  const original = openTag[0];
  const width = original.match(/\bwidth="([\d.]+)[a-z]*"/i)?.[1];
  const height = original.match(/\bheight="([\d.]+)[a-z]*"/i)?.[1];

  let updated = original
    .replace(/\s+width="[^"]*"/i, '')
    .replace(/\s+height="[^"]*"/i, '');

  if (!/\bviewBox=/i.test(updated)) {
    if (!width || !height) return;
    updated = updated.replace(/>$/, ` viewBox="0 0 ${width} ${height}">`);
  }

  if (updated === original) return;

  // Rewrite the header in place by copying the untouched remainder alongside it.
  const tagEnd = Buffer.byteLength(
    header.slice(0, (openTag.index ?? 0) + original.length),
    'utf8'
  );
  const patchedPath = `${svgPath}.patched`;
  const output = fs.openSync(patchedPath, 'w');
  const input = fs.openSync(svgPath, 'r');
  try {
    fs.writeSync(output, header.slice(0, openTag.index ?? 0) + updated);

    const chunk = Buffer.alloc(1024 * 1024);
    let position = tagEnd;
    let read = 0;
    while ((read = fs.readSync(input, chunk, 0, chunk.length, position)) > 0) {
      fs.writeSync(output, chunk, 0, read);
      position += read;
    }
  } finally {
    fs.closeSync(input);
    fs.closeSync(output);
  }
  fs.renameSync(patchedPath, svgPath);
}

/** Reports which SVG tracing backend is available, if any. */
export function svgBackend(): 'vtracer' | 'potrace' | 'magick' | null {
  if (hasCommand('vtracer')) return 'vtracer';
  if (hasCommand('potrace')) return 'potrace';
  if (magickCommand()) return 'magick';
  return null;
}

/**
 * Wraps the source pixels in an SVG container. The result renders exactly like
 * the original — no tracing, so nothing is approximated — but it carries a
 * bitmap rather than editable vector paths.
 */
async function embedInSvg(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter
): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'converter-'));
  try {
    const extension = path.extname(inputPath).toLowerCase();
    let source = inputPath;
    let mime = extension === '.png' ? 'image/png' : 'image/jpeg';

    // PNG and JPEG can go in as-is. Anything else (HEIC, RAW, TIFF) is decoded
    // to PNG first, which is lossless, so the pixels still match the source.
    if (extension !== '.png' && extension !== '.jpg' && extension !== '.jpeg') {
      onProgress('decoding source to PNG');
      source = path.join(tempDir, 'embedded.png');
      await convertRaster(inputPath, source, 'png');
      mime = 'image/png';
    }

    onProgress('embedding pixels in SVG');
    const { width, height } = await sharp(source).metadata();
    if (!width || !height) throw new Error('could not read image dimensions');

    const base64 = fs.readFileSync(source).toString('base64');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}">` +
      `<image width="${width}" height="${height}" ` +
      `xlink:href="data:${mime};base64,${base64}"/>` +
      `</svg>\n`;
    fs.writeFileSync(outputPath, svg);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/** Longest edge fed to a tracer. Vector output scales, so tracing beyond this
 * only turns sensor noise into paths. */
export const TRACE_MAX_EDGE = 2000;

/** vtracer arguments for each tracing mode. */
function vtracerArgs(mode: SvgMode): string[] {
  if (mode === 'detailed') {
    // Finest colour steps vtracer allows plus short spline segments, but a
    // speckle filter of 1 rather than 0: keeping every noise blob measured
    // 125MB against 24MB here for no visible gain.
    return [
      '--mode',
      'spline',
      '--color_precision',
      '8',
      '--gradient_step',
      '6',
      '--filter_speckle',
      '1',
      // 3.5 is the shortest segment vtracer accepts; anything lower panics.
      '--segment_length',
      '3.5',
      '--corner_threshold',
      '45',
    ];
  }
  return ['--preset', mode === 'poster' ? 'poster' : 'photo'];
}

/**
 * Raster -> SVG. Every mode except `embed` is a trace, not a format swap:
 * vtracer produces colour vector paths, potrace produces a black-and-white
 * silhouette, and ImageMagick only wraps the original pixels in an SVG
 * container, which is not real vector output.
 */
async function convertToSvg(
  inputPath: string,
  outputPath: string,
  mode: SvgMode,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  if (mode === 'embed') {
    await embedInSvg(inputPath, outputPath, onProgress);
    return;
  }

  const backend = svgBackend();
  if (!backend) {
    throw new Error(
      'SVG tracing needs a tracer — install one with: cargo install vtracer (or brew install potrace)'
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'converter-'));
  try {
    if (backend === 'vtracer') {
      onProgress('staging a PNG to trace');
      let staged = path.join(tempDir, 'staged.png');
      await convertRaster(inputPath, staged, 'png');

      // Tracing a 12MP photo at full resolution turns sensor noise into paths:
      // detailed mode produced 650MB of SVG that no viewer will open, and even
      // poster ran to 47MB. Cap the input and let the curves do the work.
      const { width = 0, height = 0 } = await sharp(staged).metadata();
      if (Math.max(width, height) > TRACE_MAX_EDGE) {
        onProgress(`downscaling to ${TRACE_MAX_EDGE}px to trace`);
        const capped = path.join(tempDir, 'capped.png');
        await sharp(staged)
          .resize({ width: TRACE_MAX_EDGE, height: TRACE_MAX_EDGE, fit: 'inside' })
          .png()
          .toFile(capped);
        staged = capped;
      }

      onProgress(`tracing colour paths with vtracer (${mode})`);
      await run('vtracer', [
        '--input',
        staged,
        '--output',
        outputPath,
        ...vtracerArgs(mode),
      ]);
      normalizeSvg(outputPath);
      return;
    }

    if (backend === 'potrace') {
      // potrace only reads bitmap formats, and only ever emits bilevel output.
      if (!hasCommand('sips')) {
        throw new Error('potrace needs sips to prepare a bitmap');
      }
      onProgress('staging a bitmap to trace');
      const staged = path.join(tempDir, 'staged.bmp');
      await run('sips', ['-s', 'format', 'bmp', inputPath, '--out', staged]);
      onProgress('tracing with potrace');
      await run('potrace', ['-s', '-o', outputPath, staged]);
      normalizeSvg(outputPath);
      return;
    }

    onProgress('wrapping pixels in SVG with ImageMagick');
    await run(magickCommand() as string, [inputPath, outputPath]);
    normalizeSvg(outputPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function convertImage(
  inputPath: string,
  outputPath: string,
  target: ImageTarget,
  svgMode: SvgMode,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  if (target === 'svg') {
    await convertToSvg(inputPath, outputPath, svgMode, onProgress);
    return;
  }
  await convertRaster(inputPath, outputPath, target, onProgress);
}

/** Reads a video's duration in seconds, or null if ffprobe can't tell us. */
async function videoDuration(inputPath: string): Promise<number | null> {
  if (!hasCommand('ffprobe')) return null;
  try {
    const binary = resolveCommand('ffprobe') as string;
    const { stdout } = await execFileAsync(binary, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

/**
 * Runs ffmpeg, translating its `-progress` stream into percentages so the
 * caller can show how far along a long encode is.
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

      const percent = Math.min(99, Math.round((seconds / durationSeconds) * 100));
      onProgress(stage, percent);
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
      const detail = stderr.trim().split('\n').pop() ?? `exit code ${code}`;
      reject(new Error(detail));
    });
  });
}

/**
 * Anything -> MP4. ffmpeg copies the streams when they are already MP4
 * compatible and re-encodes otherwise. avconvert is the zero-install macOS
 * fallback, but it always re-encodes and only reads what AVFoundation supports.
 */
export async function convertVideo(
  inputPath: string,
  outputPath: string,
  onProgress: ProgressReporter = () => {}
): Promise<void> {
  if (hasCommand('ffmpeg')) {
    const duration = await videoDuration(inputPath);

    try {
      onProgress('copying streams with ffmpeg');
      await runFfmpeg(
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inputPath,
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          outputPath,
        ],
        duration,
        'copying streams with ffmpeg',
        onProgress
      );
      return;
    } catch {
      // Streams were not MP4 compatible (e.g. VP9 in WebM) — re-encode.
      onProgress('re-encoding to H.264 with ffmpeg');
      await runFfmpeg(
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inputPath,
          '-c:v',
          'libx264',
          '-preset',
          'medium',
          '-crf',
          '20',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
          outputPath,
        ],
        duration,
        're-encoding to H.264 with ffmpeg',
        onProgress
      );
      return;
    }
  }

  if (!hasCommand('avconvert')) {
    throw new Error('no video converter found — install with: brew install ffmpeg');
  }

  onProgress('re-encoding with avconvert');
  await run('avconvert', [
    '--source',
    inputPath,
    '--output',
    outputPath,
    '--preset',
    'PresetHighestQuality',
    '--replace',
  ]);
}
