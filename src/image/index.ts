#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  intro,
  outro,
  text,
  select,
  multiselect,
  note,
  spinner,
  log,
  isCancel,
  cancel,
} from '@clack/prompts';
import {
  classify,
  alreadyInTargetFormat,
  dedupeTargets,
  IMAGE_TARGETS,
  SVG_MODES,
  SVG_MODE_HINTS,
  VIDEO_TARGET,
  type ImageTarget,
  type MediaKind,
  type SvgMode,
} from './formats';
import {
  convertImage,
  convertVideo,
  hasCommand,
  svgBackend,
  TRACE_MAX_EDGE,
} from './converters';

interface Job {
  file: string;
  kind: MediaKind;
}

const OUTPUT_FOLDER = 'converted';
const DEFAULT_FOLDER = path.join(os.homedir(), 'Downloads');

function bail(value: unknown): void {
  if (isCancel(value)) {
    cancel('Cancelled');
    process.exit(0);
  }
}

/**
 * Validates a folder or a single media file, returning an error message or
 * undefined.
 */
function validatePath(input: string): string | undefined {
  const target = input.trim().replace(/^~(?=\/|$)/, os.homedir());
  if (!target) return 'A file or folder path is required';
  if (!fs.existsSync(target)) return 'That path does not exist';
  if (fs.statSync(target).isDirectory()) return;
  if (!classify(path.basename(target))) {
    return 'That file is not a convertible image or video';
  }
  return;
}

/** Strips surrounding whitespace and expands a leading ~ to the home folder. */
function normalizePath(input: string): string {
  return input.trim().replace(/^~(?=\/|$)/, os.homedir());
}

/** Picks a free output path, appending -1, -2, ... on collision. */
function uniqueOutputPath(dir: string, baseName: string, ext: string): string {
  let candidate = path.join(dir, `${baseName}.${ext}`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${counter}.${ext}`);
    counter++;
  }
  return candidate;
}

function scan(folderPath: string): Job[] {
  return fs
    .readdirSync(folderPath)
    .filter((file) => !file.startsWith('.'))
    .filter((file) => {
      const full = path.join(folderPath, file);
      return fs.statSync(full).isFile();
    })
    .map((file): Job | null => {
      const kind = classify(file);
      return kind ? { file, kind } : null;
    })
    .filter((job): job is Job => job !== null);
}

/** Where conversions read from, and what they will work on. */
interface Source {
  /** Folder the `converted/` output folder is created in. */
  baseDir: string;
  jobs: Job[];
}

async function askSource(): Promise<Source> {
  const fromArgs = process.argv[2];
  if (fromArgs) {
    const problem = validatePath(fromArgs);
    if (problem) {
      outro(`❌ ${problem}: ${fromArgs}`);
      process.exit(1);
    }
    return toSource(normalizePath(fromArgs));
  }

  const answer = await text({
    message: 'Which file or folder should I convert?',
    placeholder: DEFAULT_FOLDER,
    defaultValue: DEFAULT_FOLDER,
    initialValue: DEFAULT_FOLDER,
    validate: validatePath,
  });
  bail(answer);
  return toSource(normalizePath(answer as string));
}

/** A folder becomes every media file inside it; a file becomes just itself. */
function toSource(target: string): Source {
  if (fs.statSync(target).isDirectory()) {
    return { baseDir: target, jobs: scan(target) };
  }

  const file = path.basename(target);
  const kind = classify(file);
  return {
    baseDir: path.dirname(target),
    jobs: kind ? [{ file, kind }] : [],
  };
}

async function askImageTargets(imageCount: number): Promise<ImageTarget[]> {
  const fromArgs = process.argv[3];
  if (fromArgs) {
    const requested = fromArgs
      .toLowerCase()
      .split(',')
      .map((value) => value.trim().replace(/^\./, ''))
      .filter(Boolean);

    if (requested.length === 0) {
      outro(
        `❌ No image format given. Choose from: ${IMAGE_TARGETS.join(', ')}`
      );
      process.exit(1);
    }

    const unknown = requested.filter(
      (value) => !IMAGE_TARGETS.includes(value as ImageTarget)
    );
    if (unknown.length > 0) {
      outro(
        `❌ Unknown image format "${unknown.join('", "')}". Choose from: ${IMAGE_TARGETS.join(', ')}`
      );
      process.exit(1);
    }
    return dedupeTargets([...new Set(requested)] as ImageTarget[]);
  }

  const traced = svgBackend();
  const answer = await multiselect({
    message: `Convert ${imageCount} image(s) to which format(s)?`,
    initialValues: ['png'] as ImageTarget[],
    required: true,
    options: IMAGE_TARGETS.map((value) => {
      if (value === 'svg') {
        return {
          value,
          label: 'svg',
          hint: traced
            ? `vector trace via ${traced}`
            : 'needs a tracer: cargo install vtracer',
        };
      }
      const hints: Record<string, string> = {
        png: 'lossless, transparency',
        jpeg: 'smallest, no transparency',
        jpg: 'same as jpeg, .jpg extension',
        webp: 'small and modern, transparency',
      };
      return { value, label: value, hint: hints[value] };
    }),
  });
  bail(answer);

  const chosen = answer as ImageTarget[];
  const targets = dedupeTargets(chosen);
  if (targets.length < chosen.length) {
    const dropped = chosen.filter((value) => !targets.includes(value));
    log.info(
      `Skipping ${dropped.join(', ')} — jpeg and jpg are the same format, ` +
        `so you would get identical files twice. Writing .${targets.find((t) => t === 'jpeg' || t === 'jpg')} only.`
    );
  }
  return targets;
}

async function askSvgMode(): Promise<SvgMode> {
  const fromArgs = process.argv[4]?.toLowerCase();
  if (fromArgs) {
    if (!SVG_MODES.includes(fromArgs as SvgMode)) {
      outro(
        `❌ Unknown SVG mode "${fromArgs}". Choose from: ${SVG_MODES.join(', ')}`
      );
      process.exit(1);
    }
    return fromArgs as SvgMode;
  }

  const traced = svgBackend();
  const answer = await select({
    message: 'How should the SVG be produced?',
    initialValue: 'embed' as SvgMode,
    options: SVG_MODES.map((value) => ({
      value,
      label: value,
      hint:
        value !== 'embed' && !traced
          ? 'needs a tracer: cargo install vtracer'
          : SVG_MODE_HINTS[value],
    })),
  });
  bail(answer);
  return answer as SvgMode;
}

async function run(): Promise<void> {
  intro('Media Converter');

  const { baseDir: folderPath, jobs } = await askSource();

  const images = jobs.filter((job) => job.kind === 'image');
  const videos = jobs.filter((job) => job.kind === 'video');

  if (jobs.length === 0) {
    outro(`❌ No convertible images or videos found in ${folderPath}`);
    process.exit(0);
  }

  // Only mention what is actually there — a single file should not report
  // "0 video(s) detected".
  const found: string[] = [];
  if (images.length > 0) found.push(`${images.length} image(s) detected`);
  if (videos.length > 0) {
    found.push(
      `${videos.length} video(s) detected  ->  .${VIDEO_TARGET} (default)`
    );
  }
  note(found.join('\n'), 'Found');

  let imageTargets: ImageTarget[] = [];
  let svgMode: SvgMode = 'embed';
  if (images.length > 0) {
    imageTargets = await askImageTargets(images.length);

    if (imageTargets.includes('svg')) {
      svgMode = await askSvgMode();
      if (svgMode !== 'embed' && !svgBackend()) {
        outro(
          '❌ Tracing needs a tracer. Install one with: cargo install vtracer, or pick the embed mode.'
        );
        process.exit(1);
      }
      if (svgMode !== 'embed') {
        log.info(
          'Tracing rebuilds the picture out of vector shapes, so it will not match the source exactly — embed does that.\n' +
            `Images larger than ${TRACE_MAX_EDGE}px are downscaled before tracing, since vector output scales on its own.`
        );
      }
    }
  }

  if (videos.length > 0 && !hasCommand('ffmpeg')) {
    log.warn(
      'ffmpeg not found — falling back to avconvert, which re-encodes and cannot read every container.\n' +
        'Install ffmpeg for full format support: brew install ffmpeg'
    );
  }

  const outputFolderPath = path.join(folderPath, OUTPUT_FOLDER);
  if (!fs.existsSync(outputFolderPath)) {
    fs.mkdirSync(outputFolderPath, { recursive: true });
  }

  // One task per output file: an image selected for three formats is three tasks.
  const tasks = jobs.flatMap((job) =>
    job.kind === 'image'
      ? imageTargets.map((target) => ({ ...job, target }))
      : [{ ...job, target: VIDEO_TARGET }]
  );

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  // Output paths this run has already claimed. Two different sources can share
  // a basename (a.jpg and a.png both wanting a.webp), and that genuine clash
  // still needs the -1 suffix — unlike a file left over from a previous run.
  const claimed = new Set<string>();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    if (alreadyInTargetFormat(task.file, task.target)) {
      // Report the file's own extension: ".jpg" skipped for a jpeg target reads
      // as nonsense if we echo the target back instead.
      log.step(
        `⏭  Skipped ${task.file} — already ${path.extname(task.file).toLowerCase()}`
      );
      skipped++;
      continue;
    }

    const inputPathForCheck = path.join(folderPath, task.file);
    const baseName = path.parse(task.file).name;
    const canonical = path.join(outputFolderPath, `${baseName}.${task.target}`);

    // When two sources share a basename (a.jpg and a.png both wanting a.webp)
    // the second is named after its source extension rather than a counter.
    // A counter cannot be traced back to the file that produced it, so on the
    // next run nothing would recognise a-1.webp as already done; a-png.webp is
    // derived from the source and therefore stable.
    const sourceExtension = path.extname(task.file).slice(1).toLowerCase();
    const desiredPath = claimed.has(canonical)
      ? path.join(outputFolderPath, `${baseName}-${sourceExtension}.${task.target}`)
      : canonical;

    // Re-running used to write IMG_1335-1.png next to an identical IMG_1335.png.
    // If the output is already there and no older than its source, the work is
    // done — say so instead of duplicating it.
    if (
      !claimed.has(desiredPath) &&
      fs.existsSync(desiredPath) &&
      fs.statSync(desiredPath).mtimeMs >= fs.statSync(inputPathForCheck).mtimeMs
    ) {
      log.step(`⏭  Skipped ${task.file} -> .${task.target} — already converted`);
      claimed.add(desiredPath);
      skipped++;
      continue;
    }

    const label = `[${i + 1}/${tasks.length}] ${task.file} -> .${task.target}`;
    const s = spinner({ indicator: 'timer' });
    s.start(`${label} — starting`);

    // The engines report which stage they reached, and ffmpeg also reports a
    // percentage, so the spinner text stays alive during slow conversions.
    const report = (stage: string, percent?: number) => {
      const suffix = percent === undefined ? '' : ` ${percent}%`;
      s.message(`${label} — ${stage}${suffix}`);
    };

    const inputPath = inputPathForCheck;
    // The counter is the last resort, for a third source sharing the basename.
    const outputPath = claimed.has(desiredPath)
      ? uniqueOutputPath(outputFolderPath, baseName, task.target)
      : desiredPath;
    claimed.add(outputPath);

    try {
      if (task.kind === 'image') {
        await convertImage(
          inputPath,
          outputPath,
          task.target as ImageTarget,
          svgMode,
          report
        );
      } else {
        await convertVideo(inputPath, outputPath, report);
      }
      s.stop(`✅ ${task.file} -> ${path.basename(outputPath)}`);
      successful++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      s.stop(`❌ Failed: ${task.file} -> .${task.target}`);
      log.error(message.trim().split('\n')[0]);
      failed++;
    }
  }

  const summary = [`✓ Converted: ${successful}`];
  if (skipped > 0) summary.push(`⏭ Skipped: ${skipped}`);
  if (failed > 0) summary.push(`✗ Failed: ${failed}`);
  note(summary.join('\n'), 'Results');

  outro(
    successful > 0
      ? `Done! Files saved to ${outputFolderPath}`
      : 'Nothing was converted.'
  );
}

run().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
