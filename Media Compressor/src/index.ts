#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  intro,
  outro,
  text,
  multiselect,
  note,
  spinner,
  log,
  isCancel,
  cancel,
} from '@clack/prompts';
import {
  classify,
  formatBytes,
  savingsLabel,
  MODES,
  PRESETS,
  OUTPUT_FOLDER,
  MIN_SAVING_RATIO,
  type MediaKind,
  type Mode,
} from './formats';
import {
  compressImage,
  compressVideo,
  hasCommand,
  videoDuration,
  NotWorthItError,
} from './compressors';

interface Job {
  file: string;
  kind: MediaKind;
  bytes: number;
}

const DEFAULT_FOLDER = path.join(os.homedir(), 'Downloads');

function bail(value: unknown): void {
  if (isCancel(value)) {
    cancel('Cancelled');
    process.exit(0);
  }
}

/** Strips surrounding whitespace and expands a leading ~ to the home folder. */
function normalizePath(input: string): string {
  return input.trim().replace(/^~(?=\/|$)/, os.homedir());
}

/** Validates a folder or media path, returning an error message or undefined. */
function validateInput(input: string): string | undefined {
  const target = normalizePath(input);
  if (!target) return 'A folder or file path is required';
  if (!fs.existsSync(target)) return 'Path does not exist';
  if (fs.statSync(target).isFile() && !classify(target)) {
    return 'That file is not a supported image or video';
  }
  return;
}

function toJob(folderPath: string, file: string): Job | null {
  const kind = classify(file);
  if (!kind) return null;
  return { file, kind, bytes: fs.statSync(path.join(folderPath, file)).size };
}

function scan(folderPath: string): Job[] {
  return fs
    .readdirSync(folderPath)
    .filter((file) => !file.startsWith('.'))
    .filter((file) => fs.statSync(path.join(folderPath, file)).isFile())
    .map((file) => toJob(folderPath, file))
    .filter((job): job is Job => job !== null);
}

async function askInput(): Promise<string> {
  const fromArgs = process.argv[2];
  if (fromArgs) {
    const problem = validateInput(fromArgs);
    if (problem) {
      outro(`❌ ${problem}: ${fromArgs}`);
      process.exit(1);
    }
    return normalizePath(fromArgs);
  }

  const answer = await text({
    message: 'Which folder (or single file) should I compress?',
    placeholder: DEFAULT_FOLDER,
    defaultValue: DEFAULT_FOLDER,
    initialValue: DEFAULT_FOLDER,
    validate: validateInput,
  });
  bail(answer);
  return normalizePath(answer as string);
}

async function askModes(): Promise<Mode[]> {
  // Comma separated, so `my_media_compressor ~/clips normal,ultra` produces
  // both a full-quality and a tiny copy of everything in one pass.
  const fromArgs = process.argv[3]?.toLowerCase();
  if (fromArgs) {
    const requested = fromArgs
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const unknown = requested.filter((value) => !(MODES as readonly string[]).includes(value));
    if (requested.length === 0 || unknown.length > 0) {
      outro(
        `❌ Unknown mode "${unknown.join('", "') || fromArgs}". Choose from: ${MODES.join(', ')}`
      );
      process.exit(1);
    }
    return [...new Set(requested)] as Mode[];
  }

  const answer = await multiselect({
    message: 'How hard should I compress? (space to select, enter to confirm)',
    initialValues: ['normal'] as Mode[],
    required: true,
    options: MODES.map((value) => ({ value, label: value, hint: PRESETS[value].label })),
  });
  bail(answer);
  return answer as Mode[];
}

async function run(): Promise<void> {
  intro('Media Compressor');

  const inputPath = await askInput();
  const isSingleFile = fs.statSync(inputPath).isFile();
  const folderPath = isSingleFile ? path.dirname(inputPath) : inputPath;

  const jobs = isSingleFile
    ? [toJob(folderPath, path.basename(inputPath))].filter((job): job is Job => job !== null)
    : scan(folderPath);

  if (jobs.length === 0) {
    outro(`❌ No images or videos found in ${folderPath}`);
    process.exit(0);
  }

  const images = jobs.filter((job) => job.kind === 'image');
  const videos = jobs.filter((job) => job.kind === 'video');
  const totalBefore = jobs.reduce((sum, job) => sum + job.bytes, 0);

  note(
    [
      `${images.length} image(s), ${videos.length} video(s)`,
      `${formatBytes(totalBefore)} total`,
    ].join('\n'),
    'Found'
  );

  const modes = await askModes();

  // One task per file per mode, so picking two modes produces two copies of
  // everything rather than two passes over the folder.
  const tasks = jobs.flatMap((job) => modes.map((mode) => ({ job, mode })));

  if (videos.length > 0 && !hasCommand('ffmpeg')) {
    outro('❌ Compressing video needs ffmpeg. Install it with: brew install ffmpeg');
    process.exit(1);
  }

  const outputFolderPath = path.join(folderPath, OUTPUT_FOLDER);
  if (!fs.existsSync(outputFolderPath)) {
    fs.mkdirSync(outputFolderPath, { recursive: true });
  }

  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let savedBefore = 0;
  let savedAfter = 0;

  for (let i = 0; i < tasks.length; i++) {
    const { job, mode } = tasks[i];
    const preset = PRESETS[mode];
    const fullInputPath = path.join(folderPath, job.file);
    const extension = path.extname(job.file).toLowerCase();

    // The mode is part of the name so the three levels never overwrite each
    // other, and so compressing at a new setting is not mistaken for work
    // already done.
    const outputPath = path.join(
      outputFolderPath,
      `${path.parse(job.file).name}-${mode}${extension}`
    );

    if (
      fs.existsSync(outputPath) &&
      fs.statSync(outputPath).mtimeMs >= fs.statSync(fullInputPath).mtimeMs
    ) {
      log.step(`⏭  Skipped ${job.file} (${mode}) — already compressed`);
      skipped++;
      continue;
    }

    const duration = job.kind === 'video' ? videoDuration(fullInputPath) : null;

    const label = `[${i + 1}/${tasks.length}] ${job.file} -> ${mode}`;
    const s = spinner({ indicator: 'timer' });
    s.start(`${label} — starting`);

    // The engines report which stage they reached, and ffmpeg also reports a
    // percentage, so the spinner stays informative during a long encode.
    const report = (stage: string, percent?: number) => {
      s.message(`${label} — ${stage}${percent === undefined ? '' : ` ${percent}%`}`);
    };

    try {
      if (job.kind === 'image') {
        await compressImage(fullInputPath, outputPath, preset, report);
      } else {
        await compressVideo(fullInputPath, outputPath, preset, duration, report);
      }

      const newBytes = fs.statSync(outputPath).size;

      // An already-optimised file either grows when re-encoded or shrinks by a
      // rounding error, and either way it has lost quality for nothing. Bin the
      // result and leave the original as the better copy.
      if (newBytes >= job.bytes * (1 - MIN_SAVING_RATIO)) {
        fs.rmSync(outputPath, { force: true });
        throw new NotWorthItError('already well compressed');
      }

      s.stop(`✅ ${path.basename(outputPath)}  ${savingsLabel(job.bytes, newBytes)}`);
      savedBefore += job.bytes;
      savedAfter += newBytes;
      successful++;
    } catch (error) {
      if (error instanceof NotWorthItError) {
        s.stop(`⏭  Skipped ${job.file} — ${error.message}`);
        skipped++;
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      s.stop(`❌ Failed: ${job.file}`);
      log.error(message.trim().split('\n')[0]);
      failed++;
    }
  }

  const summary = [`✓ Compressed: ${successful}`];
  if (skipped > 0) summary.push(`⏭ Skipped: ${skipped}`);
  if (failed > 0) summary.push(`✗ Failed: ${failed}`);
  if (successful > 0) {
    summary.push('');
    summary.push(savingsLabel(savedBefore, savedAfter));
    summary.push(`Freed ${formatBytes(savedBefore - savedAfter)}`);
  }
  note(summary.join('\n'), 'Results');

  outro(
    successful > 0
      ? `Done! Files saved to ${outputFolderPath}`
      : 'Nothing was compressed.'
  );
}

run().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
