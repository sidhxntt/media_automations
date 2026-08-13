import path from 'path';

export type MediaKind = 'image' | 'video';

/** Source image extensions we attempt to read. Anything sips/sharp/ImageMagick can open. */
export const IMAGE_EXTENSIONS = [
  '.heic',
  '.heif',
  '.jpg',
  '.jpeg',
  '.jpe',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.jp2',
  '.j2k',
  '.ico',
  '.psd',
  '.svg',
  '.dng',
  '.cr2',
  '.nef',
  '.arw',
  '.raf',
  '.orf',
  '.rw2',
];

/** Source video extensions we attempt to read. */
export const VIDEO_EXTENSIONS = [
  '.mov',
  '.qt',
  '.mp4',
  '.m4v',
  '.avi',
  '.mkv',
  '.webm',
  '.wmv',
  '.flv',
  '.mpg',
  '.mpeg',
  '.m2v',
  '.3gp',
  '.3g2',
  '.mts',
  '.m2ts',
  '.ts',
  '.ogv',
  '.vob',
  '.asf',
  '.divx',
];

/** Formats the user can convert images to. */
export const IMAGE_TARGETS = ['png', 'jpeg', 'jpg', 'webp', 'svg'] as const;
export type ImageTarget = (typeof IMAGE_TARGETS)[number];

/** Videos always convert to MP4. */
export const VIDEO_TARGET = 'mp4';

/**
 * How to produce an SVG. Only `embed` reproduces the source exactly — the other
 * three are traces, which replace continuous tone with flat vector shapes.
 */
export const SVG_MODES = ['embed', 'detailed', 'photo', 'poster'] as const;
export type SvgMode = (typeof SVG_MODES)[number];

export const SVG_MODE_HINTS: Record<SvgMode, string> = {
  embed: 'identical to the source, pixels wrapped in SVG (not vector paths)',
  detailed: 'near-photographic vector trace, slow and tens of MB',
  photo: 'faster vector trace, visibly posterised',
  poster: 'flat stylised colour blocks',
};

/**
 * Collapses targets that produce the same bytes.
 *
 * `jpeg` and `jpg` are one encoder behind two extensions, so asking for both
 * writes the identical file twice. The first one chosen wins, which keeps
 * whichever extension the user actually wanted.
 */
export function dedupeTargets(targets: ImageTarget[]): ImageTarget[] {
  const seen = new Set<string>();
  const kept: ImageTarget[] = [];
  for (const target of targets) {
    const key = target === 'jpeg' ? 'jpg' : target;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(target);
  }
  return kept;
}

export function classify(file: string): MediaKind | null {
  const ext = path.extname(file).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return null;
}

/**
 * True when the file is already in the requested format, so converting it
 * would just be a wasteful re-encode. `.jpg` and `.jpeg` count as the same.
 */
export function alreadyInTargetFormat(file: string, target: string): boolean {
  const ext = path.extname(file).toLowerCase().replace('.', '');
  const normalize = (value: string) => (value === 'jpeg' ? 'jpg' : value);
  return normalize(ext) === normalize(target);
}
