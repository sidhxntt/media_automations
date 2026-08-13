import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
  type ParagraphChild,
} from 'docx';
import { marked, type Token, type Tokens } from 'marked';

/**
 * Markdown to .docx without pandoc.
 *
 * This walks marked's token stream and emits docx primitives directly. It
 * covers the CommonMark subset people actually write — headings, emphasis,
 * code, lists, links, quotes, tables, rules — and deliberately stops there.
 * When pandoc is installed the caller prefers it, so this is the floor, not
 * the ceiling.
 */

const ORDERED_LIST_REFERENCE = 'ordered-list';
const MONO_FONT = 'Menlo';

/**
 * A4 in twentieths of a point: 210mm x 297mm.
 *
 * Set explicitly because a document with no page size falls back to whatever
 * the reader defaults to, which is US Letter in Word.
 */
const A4_WIDTH_DXA = 11906;
const A4_HEIGHT_DXA = 16838;

/** 2cm margins all round. */
const PAGE_MARGIN_DXA = 1134;

/** Usable text width. Table columns are divided out of this. */
const CONTENT_WIDTH_DXA = A4_WIDTH_DXA - PAGE_MARGIN_DXA * 2;

/**
 * Gap after a block, standing in for the blank line between markdown blocks.
 *
 * Set on every paragraph rather than left to the document defaults, because
 * Quick Look and Pages ignore docDefaults even though Word honours it.
 */
const BODY_SPACING = { after: 160 } as const;

/**
 * Named styles for code.
 *
 * A monospace font alone is a visual hint, not a meaning — converting back to
 * markdown, nothing can tell it apart from prose that happens to be in Menlo.
 * Tagging code with real styles is what lets docxToMarkdown map it back to
 * fenced blocks and backticks instead of escaped plain text.
 */
const CODE_BLOCK_STYLE = 'Code';
const CODE_INLINE_STYLE = 'CodeChar';

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
}

/** Turns inline markdown tokens into docx runs, carrying styles down the tree. */
function inlineRuns(tokens: Token[] | undefined, style: RunStyle = {}): ParagraphChild[] {
  if (!tokens) return [];
  const children: ParagraphChild[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'strong':
        children.push(...inlineRuns((token as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case 'em':
        children.push(...inlineRuns((token as Tokens.Em).tokens, { ...style, italics: true }));
        break;
      case 'del':
        children.push(...inlineRuns((token as Tokens.Del).tokens, { ...style, strike: true }));
        break;
      case 'codespan':
        children.push(runFor((token as Tokens.Codespan).text, { ...style, code: true }));
        break;
      case 'br':
        children.push(new TextRun({ break: 1 }));
        break;
      case 'link': {
        const link = token as Tokens.Link;
        const inner = inlineRuns(link.tokens, style);
        // A same-document anchor like [text](#section) has no meaning outside
        // the markdown file. Wrapping it in an external hyperlink produces a
        // blue underlined link that errors when clicked, so keep the text only.
        if (link.href.startsWith('#')) {
          children.push(...(inner.length > 0 ? inner : [runFor(link.href, style)]));
          break;
        }
        children.push(
          new ExternalHyperlink({
            link: link.href,
            children: inner.length > 0 ? inner : [runFor(link.href, style)],
          })
        );
        break;
      }
      case 'image': {
        // Embedding would mean fetching and sizing the asset; the alt text plus
        // the URL keeps the document lossless enough to be useful.
        const image = token as Tokens.Image;
        children.push(runFor(`[${image.text || 'image'}: ${image.href}]`, { ...style, italics: true }));
        break;
      }
      case 'escape':
        children.push(runFor((token as Tokens.Escape).text, style));
        break;
      case 'html':
        children.push(runFor((token as Tokens.HTML).raw, style));
        break;
      default: {
        const nested = (token as { tokens?: Token[] }).tokens;
        if (nested && nested.length > 0) {
          children.push(...inlineRuns(nested, style));
        } else {
          const text = (token as { text?: string; raw?: string }).text ?? (token as { raw?: string }).raw ?? '';
          if (text) children.push(runFor(text, style));
        }
      }
    }
  }

  return children;
}

function runFor(text: string, style: RunStyle): TextRun {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    style: style.code ? CODE_INLINE_STYLE : undefined,
  });
}

/**
 * Emits the paragraphs for a list, recursing into nested lists.
 *
 * `trailing` marks the branch that ends the whole list, so only the very last
 * bullet carries the gap that separates the list from the next block.
 */
function listParagraphs(list: Tokens.List, level: number, trailing = true): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const [itemIndex, item] of list.items.entries()) {
    const isLastItem = trailing && itemIndex === list.items.length - 1;
    const own: Token[] = [];
    const nested: Tokens.List[] = [];

    for (const token of item.tokens) {
      if (token.type === 'list') nested.push(token as Tokens.List);
      else own.push(token);
    }

    // A loose list wraps item text in paragraphs; a tight one does not.
    const inline = own.flatMap((token) =>
      token.type === 'text' || token.type === 'paragraph'
        ? inlineRuns((token as Tokens.Text).tokens ?? [{ type: 'text', raw: (token as Tokens.Text).text, text: (token as Tokens.Text).text } as Token])
        : inlineRuns([token])
    );

    paragraphs.push(
      new Paragraph({
        children: inline,
        // Markdown lists are tight; the document-wide paragraph spacing would
        // otherwise push every bullet apart. Only the final one gets a gap,
        // and if this item has a sub-list then that sub-list ends it instead.
        spacing: { after: isLastItem && nested.length === 0 ? BODY_SPACING.after : 0 },
        ...(list.ordered
          ? { numbering: { reference: ORDERED_LIST_REFERENCE, level } }
          : { bullet: { level } }),
      })
    );

    for (const [nestedIndex, child] of nested.entries()) {
      paragraphs.push(
        ...listParagraphs(child, level + 1, isLastItem && nestedIndex === nested.length - 1)
      );
    }
  }

  return paragraphs;
}

function codeParagraphs(code: Tokens.Code): Paragraph[] {
  // One paragraph per line: docx has no pre element, and a single run with
  // newlines collapses into one line. Lines stay tight against each other, but
  // the last one carries the gap that separates the block from what follows.
  const lines = code.text.split('\n');
  return lines.map(
    (line, index) =>
      new Paragraph({
        style: CODE_BLOCK_STYLE,
        spacing: { before: 0, after: index === lines.length - 1 ? BODY_SPACING.after : 0 },
        children: [new TextRun({ text: line || ' ' })],
      })
  );
}

function tableFor(token: Tokens.Table): Table {
  // A row can be ragged, so the widest row decides the column count.
  const columnCount = Math.max(token.header.length, ...token.rows.map((row) => row.length));
  const columnPercent = Math.floor(100 / columnCount);

  const headerRow = new TableRow({
    tableHeader: true,
    children: token.header.map(
      (cell) =>
        new TableCell({
          width: { size: columnPercent, type: WidthType.PERCENTAGE },
          shading: { fill: 'F1F5F9' },
          children: [new Paragraph({ children: inlineRuns(cell.tokens, { bold: true }) })],
        })
    ),
  });

  const bodyRows = token.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              width: { size: columnPercent, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: inlineRuns(cell.tokens) })],
            })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    // Without explicit column widths Word collapses every column to its
    // narrowest possible box, wrapping cell text one character per line.
    columnWidths: Array(columnCount).fill(Math.floor(CONTENT_WIDTH_DXA / columnCount)),
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...bodyRows],
  });
}

/**
 * Indent and left rule applied to quoted content. docx paragraphs are immutable
 * once constructed, so the quote depth is threaded down into blocks() rather
 * than wrapped around the result.
 */
function quoteStyle(depth: number) {
  if (depth === 0) return {};
  return {
    indent: { left: 480 * depth },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: 'CBD5E1', space: 12 },
    },
  };
}

/** Converts block-level tokens into docx children. */
function blocks(tokens: Token[], quoteDepth = 0): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  const quoted = quoteStyle(quoteDepth);

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading;
        children.push(
          new Paragraph({
            // Maps # through ###### onto Word's own Heading 1-6 styles, so the
            // document outline, navigation pane and any table of contents all
            // work rather than the text merely looking bigger.
            heading: HEADING_LEVELS[Math.min(heading.depth, 6) - 1],
            children: inlineRuns(heading.tokens),
            // Headings need air above them far more than below.
            spacing: { before: 320, after: 120 },
            // Never leave a heading stranded at the foot of a page.
            keepNext: true,
            ...quoted,
          })
        );
        break;
      }
      case 'paragraph':
        children.push(
          new Paragraph({
            children: inlineRuns((token as Tokens.Paragraph).tokens),
            spacing: BODY_SPACING,
            ...quoted,
          })
        );
        break;
      case 'list':
        children.push(...listParagraphs(token as Tokens.List, 0));
        break;
      case 'code':
        children.push(...codeParagraphs(token as Tokens.Code));
        break;
      case 'table':
        children.push(tableFor(token as Tokens.Table));
        // Word glues consecutive tables together without a separator.
        children.push(new Paragraph({ children: [] }));
        break;
      case 'blockquote':
        children.push(...blocks((token as Tokens.Blockquote).tokens, quoteDepth + 1));
        break;
      case 'hr':
        children.push(
          new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 } },
          })
        );
        break;
      case 'space':
        break;
      case 'html':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: (token as Tokens.HTML).raw.trim(), font: MONO_FONT, size: 18 })],
          })
        );
        break;
      default: {
        const text = (token as { text?: string }).text;
        if (text && text.trim()) {
          children.push(new Paragraph({ children: inlineRuns([token]) }));
        }
      }
    }
  }

  return children;
}

/** Renders a markdown string to .docx bytes. */
export async function markdownToDocxBuffer(markdown: string): Promise<Buffer> {
  const tokens = marked.lexer(markdown);

  const section: ISectionOptions = {
    properties: {
      page: {
        size: {
          width: A4_WIDTH_DXA,
          height: A4_HEIGHT_DXA,
          orientation: PageOrientation.PORTRAIT,
        },
        margin: {
          top: PAGE_MARGIN_DXA,
          right: PAGE_MARGIN_DXA,
          bottom: PAGE_MARGIN_DXA,
          left: PAGE_MARGIN_DXA,
        },
      },
    },
    children: blocks(tokens),
  };

  const document = new Document({
    styles: {
      default: {
        // Without this every paragraph butts against the next one, losing the
        // blank line that separates blocks in the markdown source.
        document: {
          paragraph: { spacing: { after: 160, line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: CODE_BLOCK_STYLE,
          name: CODE_BLOCK_STYLE,
          basedOn: 'Normal',
          run: { font: MONO_FONT, size: 20 },
          paragraph: { spacing: { before: 0, after: 0 }, shading: { fill: 'F1F5F9' } },
        },
      ],
      characterStyles: [
        {
          id: CODE_INLINE_STYLE,
          name: CODE_INLINE_STYLE,
          basedOn: 'DefaultParagraphFont',
          run: { font: MONO_FONT, shading: { fill: 'F1F5F9' } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: ORDERED_LIST_REFERENCE,
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [section],
  });

  return Packer.toBuffer(document);
}
