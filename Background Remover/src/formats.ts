import path from 'path';

/** Source extensions Vision can decode via ImageIO. */
export const IMAGE_EXTENSIONS = [
  '.heic',
  '.heif',
  '.jpg',
  '.jpeg',
  '.jpe',
  '.png',
  '.webp',
  '.tif',
  '.tiff',
  '.bmp',
  '.gif',
  '.avif',
  '.jp2',
];

/**
 * What to put behind the cut-out subject. Output is always PNG because
 * `transparent` needs an alpha channel, so there is no format choice to make.
 */
export const OUTPUT_MODES = ['transparent', 'white', 'black', 'custom'] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number];

/** Whether to keep every detected subject or only the biggest one. */
export const SUBJECT_MODES = ['all', 'largest'] as const;
export type SubjectMode = (typeof SUBJECT_MODES)[number];

/** The extension every output gets. Alpha is required, so PNG is not negotiable. */
export const OUTPUT_EXTENSION = 'png';

/** Folder created inside the input folder to hold results. */
export const OUTPUT_FOLDER = 'no-bg';

export function classify(file: string): 'image' | null {
  const ext = path.extname(file).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) ? 'image' : null;
}

/** Normalises `#aabbcc` / `aabbcc` to a sharp-compatible `#aabbcc`, or null. */
export function parseHexColor(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return `#${cleaned.toLowerCase()}`;
}

/** Solid background colour for a mode, or null when the result stays transparent. */
export function backgroundFor(mode: OutputMode, custom: string | null): string | null {
  if (mode === 'transparent') return null;
  if (mode === 'white') return '#ffffff';
  if (mode === 'black') return '#000000';
  return custom;
}
