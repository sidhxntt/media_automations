#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { intro, outro, select, note, log, isCancel, cancel } from '@clack/prompts';
import { allBuildHints, buildHint, findByAlias, resolveTools, type ResolvedTool } from './tools';
import { canAnimate, plainSplash, showSplash } from './splash';

/**
 * Read from the manifest rather than hardcoded.
 *
 * A literal here drifts the moment the version is bumped, and it had already
 * drifted two releases: the splash printed 1.0.0 while the package was 1.0.2.
 * The path resolves the same from dist/ and from src/ under ts-node.
 */
function readVersion(): string {
  try {
    const manifest = path.join(__dirname, '..', 'package.json');
    return (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = readVersion();

/** Sentinel for the menu entry that ends the session. */
const QUIT = '__quit__';

function bail(value: unknown): void {
  if (isCancel(value)) {
    cancel('Cancelled');
    process.exit(0);
  }
}

/**
 * Hands control to a tool.
 *
 * stdio is inherited so the tool draws its own prompts directly on this
 * terminal — the launcher gets out of the way entirely rather than trying to
 * proxy another interactive UI.
 */
function launch(tool: ResolvedTool, args: string[]): number {
  const [command, ...fixed] = tool.argv as string[];
  const result = spawnSync(command, [...fixed, ...args], { stdio: 'inherit' });

  if (result.error) {
    log.error(`Could not run ${tool.label}: ${result.error.message}`);
    return 1;
  }
  // A tool killed by Ctrl-C reports a signal rather than an exit code.
  if (result.signal) return 130;
  return result.status ?? 0;
}

async function askTool(tools: ResolvedTool[]): Promise<ResolvedTool | typeof QUIT> {
  const answer = await select({
    message: 'Which tool?',
    options: [
      ...tools.map((tool) => ({
        value: tool.alias,
        label: tool.argv ? tool.label : `${tool.label} (not built)`,
        hint: tool.summary,
      })),
      { value: QUIT, label: 'quit', hint: 'exit the launcher' },
    ],
  });
  bail(answer);

  if (answer === QUIT) return QUIT;
  return tools.find((tool) => tool.alias === answer) as ResolvedTool;
}

async function run(): Promise<void> {
  const tools = resolveTools();

  // Flags belong to the launcher, not to the tool it starts, so they are taken
  // out before the first remaining argument is read as a tool name.
  // Only the leading run of launcher flags is consumed. Everything from the
  // alias onwards is the tool's own argv and is handed over verbatim: filtering
  // the whole array would silently eat an identically named flag belonging to a
  // tool, so `auto convert notes.md --no-splash` would lose an argument it was
  // never the launcher's business to read.
  const LAUNCHER_FLAGS = ['--no-splash'];
  const argv = process.argv.slice(2);
  let first = 0;
  while (first < argv.length && LAUNCHER_FLAGS.includes(argv[first])) first++;
  const [requested, ...passthrough] = argv.slice(first);

  // Named directly, so this is a shortcut rather than a menu:
  //   my_automations compress ~/clips ultra
  if (requested) {
    const tool = findByAlias(requested);
    if (!tool) {
      intro('Media Automations');
      outro(
        `❌ Unknown tool "${requested}". Try one of: ${tools.map((t) => t.alias).join(', ')}`
      );
      process.exit(1);
    }
    if (!tool.argv) {
      intro('Media Automations');
      note(buildHint(tool), 'Not built');
      outro('❌ Nothing to run.');
      process.exit(1);
    }
    process.exit(launch(tool, passthrough));
  }

  // The splash belongs to the menu only. `auto compress ...` is someone in a
  // hurry, and an animation would just stand in front of the work.
  if (canAnimate()) {
    await showSplash(VERSION);
    // The splash is the title, so the intro contributes only clack's opening
    // bar — without it the menu has no top cap to close against at the end.
    intro('');
  } else {
    intro(plainSplash(VERSION));
  }

  const available = tools.filter((tool) => tool.argv);
  if (available.length === 0) {
    note(allBuildHints().join('\n'), 'Nothing is built yet');
    outro('❌ No tools are ready to run.');
    process.exit(1);
  }

  const missing = tools.filter((tool) => !tool.argv);
  if (missing.length > 0) {
    log.info(
      `${missing.map((tool) => tool.label).join(', ')} ` +
        `${missing.length === 1 ? 'is' : 'are'} not built — select for instructions.`
    );
  }

  // Loop rather than exit, so a session of several conversions is one command.
  for (;;) {
    const choice = await askTool(tools);
    if (choice === QUIT) {
      outro('Bye.');
      return;
    }

    if (!choice.argv) {
      note(buildHint(choice), 'Not built');
      continue;
    }

    // The tool owns the terminal from here, including its own intro and outro.
    const code = launch(choice, []);
    if (code !== 0 && code !== 130) {
      log.warn(`${choice.label} exited with code ${code}.`);
    }

    const again = await select({
      message: 'Anything else?',
      initialValue: 'menu',
      options: [
        { value: 'menu', label: 'back to the menu' },
        { value: 'quit', label: 'quit' },
      ],
    });
    bail(again);
    if (again === 'quit') {
      outro('Bye.');
      return;
    }
  }
}

run().catch((error: Error) => {
  console.error('Error:', error);
  process.exit(1);
});
