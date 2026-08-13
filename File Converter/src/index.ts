#!/usr/bin/env node

// One of the document dependencies touches an experimental Node API on import,
// and the resulting warning lands in the middle of the prompt output. Nothing
// the user can act on, so keep it out of the way.
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name !== 'ExperimentalWarning') console.warn(warning);
});

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
  commonTargets,
  familyOf,
  alreadyInTargetFormat,
  FAMILIES,
  FAMILY_LABEL,
  GIF_FPS,
  GIF_WIDTHS,
  type Family,
  type Source,
  type Target,
} from './formats';
import {
  hasCommand,
  ensurePdfHelper,
  markdownToHtml,
  markdownToDocx,
  htmlToDocx,
  htmlToMarkdown,
  docxToHtml,
  docxToMarkdown,
  documentToPdf,
  convertData,
  sheetCount,
  videoToGif,
  toMp3,
  toWav,
  mediaDuration,
  type GifOptions,
  type ProgressReporter,
} from './engines';

interface Job {
  file: string;
  source: Source;
  family: Family;
}

const OUTPUT_FOLDER = 'converted';
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

/** Validates a folder or file path, returning an error message or undefined. */
function validateInput(input: string): string | undefined {
  const target = normalizePath(input);
  if (!target) return 'A folder or file path is required';
  if (!fs.existsSync(target)) return 'Path does not exist';
  if (fs.statSync(target).isFile() && !classify(target)) {
    return 'That file type is not supported';
  }
  return;
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

function toJob(file: string): Job | null {
  const source = classify(file);
  return source ? { file, source, family: familyOf(source) } : null;
}

function scan(folderPath: string): Job[] {
  return fs
    .readdirSync(folderPath)
    .filter((file) => !file.startsWith('.'))
    .filter((file) => fs.statSync(path.join(folderPath, file)).isFile())
    .map(toJob)
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
    message: 'Which folder (or single file) should I convert?',
    placeholder: DEFAULT_FOLDER,
    defaultValue: DEFAULT_FOLDER,
    initialValue: DEFAULT_FOLDER,
    validate: validateInput,
  });
  bail(answer);
  return normalizePath(answer as string);
}

/** Hint text naming the engine that will actually do the work. */
function hintFor(family: Family, target: Target): string {
  const pandoc = hasCommand('pandoc');
  if (family === 'document') {
    if (target === 'docx') return pandoc ? 'via pandoc' : 'built-in renderer';
    if (target === 'pdf') return 'via WebKit';
    if (target === 'md') return pandoc ? 'via pandoc' : 'via mammoth + turndown';
    if (target === 'html') return 'styled, print-ready';
  }
  if (family === 'data') {
    if (target === 'xlsx') return 'one sheet, bold header';
    return 'first sheet / top-level rows';
  }
  if (target === 'gif') return 'two-pass palette, best quality';
  if (target === 'mp3') return 'V2 VBR, audio only';
  if (target === 'wav') return '16-bit PCM';
  return '';
}

async function askTargets(family: Family, jobs: Job[], allowArgv: boolean): Promise<Target[]> {
  const sources = [...new Set(jobs.map((job) => job.source))];
  const targets = commonTargets(sources);

  if (targets.length === 0) {
    outro(
      `❌ The ${FAMILY_LABEL[family]}s in this folder have no conversion target in common (${sources.join(', ')})`
    );
    process.exit(1);
  }

  // Only a single-family batch can take its target from argv — with documents
  // and videos in one folder there is no way to tell which "docx" was meant.
  // Comma separated, so `my_file_converter notes.md docx,pdf` writes both.
  const fromArgs = allowArgv ? process.argv[3]?.toLowerCase() : undefined;
  if (fromArgs) {
    const requested = fromArgs
      .split(',')
      .map((value) => value.trim().replace(/^\./, ''))
      .filter(Boolean);
    const unknown = requested.filter((value) => !targets.includes(value as Target));
    if (requested.length === 0 || unknown.length > 0) {
      outro(
        `❌ Cannot convert ${sources.join('/')} to "${unknown.join('", "') || fromArgs}". Try: ${targets.join(', ')}`
      );
      process.exit(1);
    }
    return [...new Set(requested)] as Target[];
  }

  const answer = await multiselect({
    message: `Convert ${jobs.length} ${FAMILY_LABEL[family]}(s) to which format(s)?`,
    initialValues: [targets[0]],
    required: true,
    options: targets.map((value) => ({ value, label: value, hint: hintFor(family, value) })),
  });
  bail(answer);
  return answer as Target[];
}

async function askGifOptions(): Promise<GifOptions> {
  const fpsArg = process.argv[4];
  const widthArg = process.argv[5];
  if (fpsArg && widthArg) {
    if (!(GIF_FPS as readonly string[]).includes(fpsArg)) {
      outro(`❌ Unknown GIF frame rate "${fpsArg}". Choose one of: ${GIF_FPS.join(', ')}`);
      process.exit(1);
    }
    if (!(GIF_WIDTHS as readonly string[]).includes(widthArg)) {
      outro(`❌ Unknown GIF width "${widthArg}". Choose one of: ${GIF_WIDTHS.join(', ')}`);
      process.exit(1);
    }
    return { fps: fpsArg, width: widthArg };
  }

  const fps = await select({
    message: 'GIF frame rate?',
    initialValue: '15' as (typeof GIF_FPS)[number],
    options: GIF_FPS.map((value) => ({
      value,
      label: `${value} fps`,
      hint: value === '10' ? 'smallest file' : value === '24' ? 'smoothest' : 'balanced',
    })),
  });
  bail(fps);

  const width = await select({
    message: 'GIF width?',
    initialValue: '640' as (typeof GIF_WIDTHS)[number],
    options: GIF_WIDTHS.map((value) => ({
      value,
      label: value === 'original' ? 'original' : `${value}px`,
      hint: value === 'original' ? 'no downscale — large files' : '',
    })),
  });
  bail(width);

  return { fps: fps as string, width: width as string };
}

/** Runs one job. Throws on failure; the caller owns all presentation. */
async function convert(
  job: Job,
  inputPath: string,
  outputPath: string,
  target: Target,
  gifOptions: GifOptions | null,
  pdfHelper: string | null,
  duration: number | null,
  report: ProgressReporter
): Promise<void> {
  const { source } = job;

  if (target === 'pdf') {
    await documentToPdf(pdfHelper as string, inputPath, outputPath, source, report);
    return;
  }
  if (target === 'gif') {
    await videoToGif(inputPath, outputPath, gifOptions as GifOptions, duration, report);
    return;
  }
  if (target === 'mp3') {
    await toMp3(inputPath, outputPath, duration, report);
    return;
  }
  if (target === 'wav') {
    await toWav(inputPath, outputPath, duration, report);
    return;
  }

  if (job.family === 'data') {
    await convertData(inputPath, outputPath, source, target, report);
    return;
  }

  const isMarkdown = source === 'md' || source === 'markdown';
  const isHtml = source === 'html' || source === 'htm';

  if (target === 'html') {
    if (isMarkdown) return markdownToHtml(inputPath, outputPath, report);
    return docxToHtml(inputPath, outputPath, report);
  }
  if (target === 'docx') {
    if (isMarkdown) return markdownToDocx(inputPath, outputPath, report);
    return htmlToDocx(inputPath, outputPath, report);
  }
  if (target === 'md') {
    if (isHtml) return htmlToMarkdown(inputPath, outputPath, report);
    return docxToMarkdown(inputPath, outputPath, report);
  }

  throw new Error(`no engine for ${source} -> ${target}`);
}

async function run(): Promise<void> {
  intro('File Converter');

  const inputPath = await askInput();
  const isSingleFile = fs.statSync(inputPath).isFile();
  const folderPath = isSingleFile ? path.dirname(inputPath) : inputPath;

  const jobs = isSingleFile
    ? [toJob(path.basename(inputPath))].filter((job): job is Job => job !== null)
    : scan(folderPath);

  if (jobs.length === 0) {
    outro(`❌ No convertible files found in ${folderPath}`);
    process.exit(0);
  }

  const present = FAMILIES.filter((family) => jobs.some((job) => job.family === family));
  note(
    present
      .map((family) => {
        const count = jobs.filter((job) => job.family === family).length;
        return `${count} ${FAMILY_LABEL[family]}(s)`;
      })
      .join('\n'),
    'Found'
  );

  // One target choice per family present, so a mixed folder is one pass.
  const targets = new Map<Family, Target[]>();
  for (const family of present) {
    targets.set(
      family,
      await askTargets(family, jobs.filter((job) => job.family === family), present.length === 1)
    );
  }

  const allTargets = [...targets.values()].flat();
  const wantsGif = allTargets.includes('gif');
  const gifOptions = wantsGif ? await askGifOptions() : null;

  const needsFfmpeg = allTargets.some((target) => ['gif', 'mp3', 'wav'].includes(target));
  if (needsFfmpeg && !hasCommand('ffmpeg')) {
    outro('❌ Media conversion needs ffmpeg. Install it with: brew install ffmpeg');
    process.exit(1);
  }

  const wantsDocuments = present.includes('document');
  if (wantsDocuments && !hasCommand('pandoc')) {
    log.warn(
      'pandoc not found — using the built-in renderers, which cover everyday markdown.\n' +
        'For the highest fidelity on complex documents: brew install pandoc'
    );
  }

  let pdfHelper: string | null = null;
  if (allTargets.includes('pdf')) {
    try {
      pdfHelper = ensurePdfHelper();
    } catch (error) {
      outro(`❌ ${(error as Error).message}`);
      process.exit(1);
    }
  }

  const outputFolderPath = path.join(folderPath, OUTPUT_FOLDER);
  if (!fs.existsSync(outputFolderPath)) {
    fs.mkdirSync(outputFolderPath, { recursive: true });
  }

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  // Output paths this run has already claimed. Two different sources can share
  // a basename (notes.md and notes.docx both wanting notes.pdf), and that
  // genuine clash still needs disambiguating — unlike a leftover from a
  // previous run.
  const claimed = new Set<string>();

  // One task per file per chosen target, so picking docx and pdf converts each
  // document twice in a single pass.
  const tasks = jobs.flatMap((job) =>
    (targets.get(job.family) ?? []).map((target) => ({ job, target }))
  );

  for (let i = 0; i < tasks.length; i++) {
    const { job, target } = tasks[i];

    if (alreadyInTargetFormat(job.file, target)) {
      log.step(`⏭  Skipped ${job.file} — already .${target}`);
      skipped++;
      continue;
    }

    const fullInputPath = path.join(folderPath, job.file);
    const baseName = path.parse(job.file).name;
    const canonical = path.join(outputFolderPath, `${baseName}.${target}`);

    // When two sources share a basename, the second is named after its source
    // extension rather than a counter. A counter cannot be traced back to the
    // file that produced it, so the next run would not recognise it as done.
    const sourceExtension = path.extname(job.file).slice(1).toLowerCase();
    const desiredPath = claimed.has(canonical)
      ? path.join(outputFolderPath, `${baseName}-${sourceExtension}.${target}`)
      : canonical;

    // Already converted on an earlier run, and the source has not changed.
    if (
      !claimed.has(desiredPath) &&
      fs.existsSync(desiredPath) &&
      fs.statSync(desiredPath).mtimeMs >= fs.statSync(fullInputPath).mtimeMs
    ) {
      log.step(`⏭  Skipped ${job.file} -> .${target} — already converted`);
      claimed.add(desiredPath);
      skipped++;
      continue;
    }

    // Warn only about work actually about to happen, not about skipped files.
    if (job.source === 'xlsx') {
      const sheets = await sheetCount(fullInputPath).catch(() => 1);
      if (sheets > 1) {
        log.warn(`${job.file} has ${sheets} sheets — only the first will be converted`);
      }
    }

    const label = `[${i + 1}/${tasks.length}] ${job.file} -> .${target}`;
    const s = spinner({ indicator: 'timer' });
    s.start(`${label} — starting`);

    // The engines report which stage they reached, and ffmpeg also reports a
    // percentage, so the spinner stays informative during slow conversions.
    const report = (stage: string, percent?: number) => {
      s.message(`${label} — ${stage}${percent === undefined ? '' : ` ${percent}%`}`);
    };

    // The counter is the last resort, for a third source sharing the basename.
    const outputPath = claimed.has(desiredPath)
      ? uniqueOutputPath(outputFolderPath, baseName, target)
      : desiredPath;
    claimed.add(outputPath);

    const duration =
      job.family === 'video' || job.family === 'audio' ? mediaDuration(fullInputPath) : null;

    try {
      await convert(job, fullInputPath, outputPath, target, gifOptions, pdfHelper, duration, report);
      s.stop(`✅ ${job.file} -> ${path.basename(outputPath)}`);
      successful++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      s.stop(`❌ Failed: ${job.file} -> .${target}`);
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
