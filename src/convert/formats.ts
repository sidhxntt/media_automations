import path from 'path';

/** Everything this tool knows how to read. */
export const SOURCES = [
  'md',
  'markdown',
  'docx',
  'html',
  'htm',
  'csv',
  'json',
  'yaml',
  'yml',
  'xlsx',
  'mp4',
  'mov',
  'mkv',
  'webm',
  'avi',
  'm4v',
  'wav',
  'm4a',
  'aac',
  'flac',
  'ogg',
  'mp3',
] as const;
export type Source = (typeof SOURCES)[number];

/**
 * Which targets each source can reach. This single table drives the select
 * options, the argv validator and the readme, so none of them can drift apart.
 */
export const MATRIX = {
  md: ['docx', 'pdf', 'html'],
  markdown: ['docx', 'pdf', 'html'],
  docx: ['md', 'pdf', 'html'],
  html: ['pdf', 'md', 'docx'],
  htm: ['pdf', 'md', 'docx'],
  csv: ['json', 'yaml', 'xlsx'],
  json: ['csv', 'yaml', 'xlsx'],
  yaml: ['json', 'csv', 'xlsx'],
  yml: ['json', 'csv', 'xlsx'],
  xlsx: ['csv', 'json', 'yaml'],
  mp4: ['gif', 'mp3'],
  mov: ['gif', 'mp3'],
  mkv: ['gif', 'mp3'],
  webm: ['gif', 'mp3'],
  avi: ['gif', 'mp3'],
  m4v: ['gif', 'mp3'],
  wav: ['mp3'],
  m4a: ['mp3'],
  aac: ['mp3'],
  flac: ['mp3'],
  ogg: ['mp3'],
  mp3: ['wav'],
} as const satisfies Record<Source, readonly string[]>;

export type Target = (typeof MATRIX)[Source][number];

/** Groups sources that share a conversion story, for the folder-mode prompts. */
export const FAMILIES = ['document', 'data', 'video', 'audio'] as const;
export type Family = (typeof FAMILIES)[number];

const FAMILY_OF: Record<Source, Family> = {
  md: 'document',
  markdown: 'document',
  docx: 'document',
  html: 'document',
  htm: 'document',
  csv: 'data',
  json: 'data',
  yaml: 'data',
  yml: 'data',
  xlsx: 'data',
  mp4: 'video',
  mov: 'video',
  mkv: 'video',
  webm: 'video',
  avi: 'video',
  m4v: 'video',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  flac: 'audio',
  ogg: 'audio',
  mp3: 'audio',
};

/** Human label for a family, used in the "Found" note. */
export const FAMILY_LABEL: Record<Family, string> = {
  document: 'document',
  data: 'data file',
  video: 'video',
  audio: 'audio file',
};

/** GIF frame rates offered when the batch contains video. */
export const GIF_FPS = ['10', '15', '24'] as const;

/** GIF widths in pixels; `original` keeps the source resolution. */
export const GIF_WIDTHS = ['480', '640', '800', 'original'] as const;

export function classify(file: string): Source | null {
  const ext = path.extname(file).toLowerCase().replace('.', '');
  return (SOURCES as readonly string[]).includes(ext) ? (ext as Source) : null;
}

export function familyOf(source: Source): Family {
  return FAMILY_OF[source];
}

/**
 * Targets reachable from every source in the list. A mixed folder of .md and
 * .docx can only offer what both support, so the prompt never shows a choice
 * that would fail for half the batch.
 */
export function commonTargets(sources: Source[]): Target[] {
  if (sources.length === 0) return [];
  const lists = sources.map((source) => MATRIX[source] as readonly string[]);
  const [first, ...rest] = lists;
  return first.filter((target) => rest.every((list) => list.includes(target))) as Target[];
}

/**
 * True when the file is already in the requested format, so converting it
 * would just be a wasteful re-encode. `.md` and `.markdown` count as the same.
 */
export function alreadyInTargetFormat(file: string, target: string): boolean {
  const ext = path.extname(file).toLowerCase().replace('.', '');
  const normalize = (value: string) => {
    if (value === 'markdown') return 'md';
    if (value === 'htm') return 'html';
    if (value === 'yml') return 'yaml';
    return value;
  };
  return normalize(ext) === normalize(target);
}
