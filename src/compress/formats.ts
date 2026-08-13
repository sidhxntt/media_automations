import path from 'path';

export type MediaKind = 'image' | 'video';

/** Image extensions sharp can read and write back in the same format. */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.jpe', '.png', '.webp', '.tif', '.tiff', '.avif'];

/** Video extensions ffmpeg will re-encode. */
export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.m4v',
  '.mkv',
  '.webm',
  '.avi',
  '.wmv',
  '.flv',
  '.mpg',
  '.mpeg',
  '.3gp',
  '.mts',
  '.m2ts',
  '.ts',
];

/** How hard to squeeze. */
export const MODES = ['normal', 'super', 'ultra'] as const;
export type Mode = (typeof MODES)[number];

/**
 * Per-mode settings.
 *
 * `maxEdge` caps the longest side; the shorter side follows the aspect ratio.
 * `crf` is the x264 quality scale where lower is better — 23 is the ffmpeg
 * default, and each +6 roughly halves the bitrate.
 */
export interface Preset {
  imageQuality: number;
  imageMaxEdge: number | null;
  crf: number;
  videoMaxEdge: number | null;
  maxFps: number | null;
  audioBitrate: string;
  label: string;
}

export const PRESETS: Record<Mode, Preset> = {
  normal: {
    imageQuality: 85,
    imageMaxEdge: null,
    crf: 23,
    videoMaxEdge: null,
    maxFps: null,
    audioBitrate: '128k',
    label: 'visually lossless, original dimensions',
  },
  super: {
    imageQuality: 70,
    imageMaxEdge: 2560,
    crf: 28,
    videoMaxEdge: 1920,
    maxFps: null,
    audioBitrate: '96k',
    label: 'small, caps images at 2560px and video at 1080p',
  },
  ultra: {
    imageQuality: 55,
    imageMaxEdge: 1600,
    crf: 32,
    videoMaxEdge: 1280,
    maxFps: 30,
    audioBitrate: '64k',
    label: 'smallest, caps images at 1600px and video at 720p30',
  },
};

/** Folder created inside the input folder to hold results. */
export const OUTPUT_FOLDER = 'compressed';

/**
 * Smallest saving worth accepting.
 *
 * Re-encoding always costs some quality. Below this the trade is a bad one —
 * an already-optimised file would lose detail for a rounding error of disk
 * space — so the result is thrown away and the original left alone.
 */
export const MIN_SAVING_RATIO = 0.05;

export function classify(file: string): MediaKind | null {
  const ext = path.extname(file).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return null;
}

/** Bytes as a short human string, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "3.1 MB -> 640 KB (-80%)" */
export function savingsLabel(originalBytes: number, newBytes: number): string {
  const delta = originalBytes > 0 ? Math.round((1 - newBytes / originalBytes) * 100) : 0;
  const sign = delta >= 0 ? '-' : '+';
  return `${formatBytes(originalBytes)} -> ${formatBytes(newBytes)} (${sign}${Math.abs(delta)}%)`;
}
