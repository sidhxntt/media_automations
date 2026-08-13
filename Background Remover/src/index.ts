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
  backgroundFor,
  parseHexColor,
  OUTPUT_MODES,
  OUTPUT_EXTENSION,
  OUTPUT_FOLDER,
  SUBJECT_MODES,
  type OutputMode,
  type SubjectMode,
} from './formats';
import {
  ensureHelper,
  removeBackground,
  flattenOnto,
  isAlreadyTransparent,
  NoSubjectError,
} from './remover';

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

/** Validates a folder or image path, returning an error message or undefined. */
function validateInput(input: string): string | undefined {
  const target = normalizePath(input);
  if (!target) return 'A folder or image path is required';
  if (!fs.existsSync(target)) return 'Path does not exist';
  if (fs.statSync(target).isFile() && !classify(target)) {
    return 'That file is not a supported image';
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

function scan(folderPath: string): string[] {
  return fs
    .readdirSync(folderPath)
    .filter((file) => !file.startsWith('.'))
    .filter((file) => fs.statSync(path.join(folderPath, file)).isFile())
    .filter((file) => classify(file) !== null);
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
    message: 'Which folder (or single image) should I process?',
    placeholder: DEFAULT_FOLDER,
    defaultValue: DEFAULT_FOLDER,
    initialValue: DEFAULT_FOLDER,
    validate: validateInput,
  });
  bail(answer);
  return normalizePath(answer as string);
}

async function askOutputModes(): Promise<OutputMode[]> {
  const hints: Record<OutputMode, string> = {
    transparent: 'PNG with alpha',
    white: 'flatten onto white',
    black: 'flatten onto black',
    custom: 'flatten onto a hex colour',
  };

  // argv accepts hex colours directly, since "custom" alone would still need a
  // second prompt and that defeats the point of passing it on the command line.
  // Comma separated, so `my_bg_remover pic.jpg transparent,white` writes both.
  const fromArgs = process.argv[3]?.toLowerCase();
  if (fromArgs) {
    const requested = fromArgs.split(',').map((value) => value.trim()).filter(Boolean);
    const modes: OutputMode[] = [];
    for (const value of requested) {
      if (parseHexColor(value)) {
        modes.push('custom');
        continue;
      }
      if (!OUTPUT_MODES.includes(value as OutputMode) || value === 'custom') {
        outro(
          `❌ Unknown background "${value}". Use transparent, white, black or a hex colour like #1e293b`
        );
        process.exit(1);
      }
      modes.push(value as OutputMode);
    }
    if (modes.length === 0) {
      outro('❌ No background given. Use transparent, white, black or a hex colour.');
      process.exit(1);
    }
    return [...new Set(modes)];
  }

  const answer = await multiselect({
    message: 'What should replace the background? (space to select, enter to confirm)',
    initialValues: ['transparent'] as OutputMode[],
    required: true,
    options: OUTPUT_MODES.map((value) => ({ value, label: value, hint: hints[value] })),
  });
  bail(answer);
  return answer as OutputMode[];
}

async function askCustomColor(): Promise<string> {
  const fromArgs = (process.argv[3] ?? '')
    .split(',')
    .map((value) => parseHexColor(value.trim()))
    .find((value): value is string => value !== null);
  if (fromArgs) return fromArgs;

  const answer = await text({
    message: 'Background colour (hex)',
    placeholder: '#ffffff',
    defaultValue: '#ffffff',
    initialValue: '#ffffff',
    validate: (input) =>
      parseHexColor(input) ? undefined : 'Enter a 6-digit hex colour, e.g. #1e293b',
  });
  bail(answer);
  return parseHexColor(answer as string) as string;
}

async function askSubjectMode(): Promise<SubjectMode> {
  const hints: Record<SubjectMode, string> = {
    all: 'keep every detected subject',
    largest: 'keep only the biggest subject',
  };

  const fromArgs = process.argv[4]?.toLowerCase();
  if (fromArgs) {
    if (!SUBJECT_MODES.includes(fromArgs as SubjectMode)) {
      outro(`❌ Unknown subject mode "${fromArgs}". Choose one of: ${SUBJECT_MODES.join(', ')}`);
      process.exit(1);
    }
    return fromArgs as SubjectMode;
  }

  const answer = await select({
    message: 'Which subjects should I keep?',
    initialValue: 'all' as SubjectMode,
    options: SUBJECT_MODES.map((value) => ({ value, label: value, hint: hints[value] })),
  });
  bail(answer);
  return answer as SubjectMode;
}

async function run(): Promise<void> {
  intro('Background Remover');

  const inputPath = await askInput();
  const isSingleFile = fs.statSync(inputPath).isFile();
  const folderPath = isSingleFile ? path.dirname(inputPath) : inputPath;
  const files = isSingleFile ? [path.basename(inputPath)] : scan(folderPath);

  if (files.length === 0) {
    outro(`❌ No supported images found in ${folderPath}`);
    process.exit(0);
  }

  note(`${files.length} image(s) detected`, 'Found');

  const outputModes = await askOutputModes();
  const customColor = outputModes.includes('custom') ? await askCustomColor() : null;
  const subjectMode = await askSubjectMode();

  // One task per image per background, so picking transparent and white gives
  // both cut-outs in a single pass.
  const tasks = files.flatMap((file) =>
    outputModes.map((mode) => ({
      file,
      mode,
      background: backgroundFor(mode, customColor),
    }))
  );

  // Resolve the Vision helper before the loop so a missing toolchain fails
  // once, up front, instead of once per file.
  let helper: string;
  try {
    helper = ensureHelper();
  } catch (error) {
    outro(`❌ ${(error as Error).message}`);
    process.exit(1);
  }

  const outputFolderPath = path.join(folderPath, OUTPUT_FOLDER);
  if (!fs.existsSync(outputFolderPath)) {
    fs.mkdirSync(outputFolderPath, { recursive: true });
  }

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  // Output paths this run has already claimed. Two different sources can share
  // a basename (a.jpg and a.png both wanting a.png), and that genuine clash
  // still needs disambiguating — unlike a file left over from a previous run.
  const claimed = new Set<string>();

  for (let i = 0; i < tasks.length; i++) {
    const { file, mode, background } = tasks[i];
    const fullInputPath = path.join(folderPath, file);

    if (background === null && (await isAlreadyTransparent(fullInputPath))) {
      log.step(`⏭  Skipped ${file} — already transparent`);
      skipped++;
      continue;
    }

    // The background is part of the name so the variants never overwrite each
    // other, and so re-running with a new background is not mistaken for work
    // already done.
    const label = mode === 'custom' ? (customColor as string).replace('#', '') : mode;
    const baseName = `${path.parse(file).name}-${label}`;
    const canonical = path.join(outputFolderPath, `${baseName}.${OUTPUT_EXTENSION}`);

    // When two sources share a basename, the second is named after its source
    // extension rather than a counter. A counter cannot be traced back to the
    // file that produced it, so the next run would not recognise it as done.
    const sourceExtension = path.extname(file).slice(1).toLowerCase();
    const desiredPath = claimed.has(canonical)
      ? path.join(outputFolderPath, `${baseName}-${sourceExtension}.${OUTPUT_EXTENSION}`)
      : canonical;

    // Already cut out on an earlier run, and the source has not changed since.
    if (
      !claimed.has(desiredPath) &&
      fs.existsSync(desiredPath) &&
      fs.statSync(desiredPath).mtimeMs >= fs.statSync(fullInputPath).mtimeMs
    ) {
      log.step(`⏭  Skipped ${file} — already done`);
      claimed.add(desiredPath);
      skipped++;
      continue;
    }

    const spinnerLabel = `[${i + 1}/${tasks.length}] ${file} -> ${label}`;
    const s = spinner({ indicator: 'timer' });
    s.start(`${spinnerLabel} — starting`);

    // The engines report which stage they reached, so a slow Vision pass on a
    // large photo does not look like a hang.
    const report = (stage: string) => s.message(`${spinnerLabel} — ${stage}`);

    // The counter is the last resort, for a third source sharing the basename.
    const outputPath = claimed.has(desiredPath)
      ? uniqueOutputPath(outputFolderPath, baseName, OUTPUT_EXTENSION)
      : desiredPath;
    claimed.add(outputPath);

    try {
      removeBackground(helper, fullInputPath, outputPath, subjectMode, report);
      if (background) await flattenOnto(outputPath, background, report);
      s.stop(`✅ ${file} -> ${path.basename(outputPath)}`);
      successful++;
    } catch (error) {
      if (error instanceof NoSubjectError) {
        s.stop(`⏭  Skipped ${file} — no subject detected`);
        skipped++;
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      s.stop(`❌ Failed: ${file}`);
      log.error(message.trim().split('\n')[0]);
      failed++;
    }
  }

  const summary = [`✓ Removed: ${successful}`];
  if (skipped > 0) summary.push(`⏭ Skipped: ${skipped}`);
  if (failed > 0) summary.push(`✗ Failed: ${failed}`);
  note(summary.join('\n'), 'Results');

  outro(
    successful > 0
      ? `Done! Files saved to ${outputFolderPath}`
      : 'Nothing was processed.'
  );
}

run().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
