/**
 * Content parsing utilities for chat message rendering
 */

export type Alignment = 'left' | 'center' | 'right';

export interface TextBlock {
  type: 'text';
  content: string;
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
  alignments: Alignment[];
}

export interface CodeBlock {
  type: 'code';
  language: string;
  content: string;
}

export type ContentBlock = TextBlock | TableBlock | CodeBlock;

/**
 * Parse a markdown table string into structured data
 */
export function parseMarkdownTable(tableText: string): TableBlock | null {
  const lines = tableText
    .trim()
    .split('\n')
    .filter((line) => line.trim());
  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] => {
    // Handle rows with leading/trailing pipes
    const trimmed = line.trim();
    const withoutPipes = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const cleaned = withoutPipes.endsWith('|') ? withoutPipes.slice(0, -1) : withoutPipes;
    return cleaned.split('|').map((cell) => cell.trim());
  };

  // Check if second line is a separator (contains dashes)
  const secondLine = lines[1].trim();
  if (!/^[|\s\-:]+$/.test(secondLine)) {
    return null;
  }

  const headers = parseRow(lines[0]);
  const separators = parseRow(lines[1]);

  // Parse alignments from separator row (e.g., ":---", ":---:", "---:")
  const alignments: Alignment[] = separators.map((sep) => {
    const trimmed = sep.trim().replace(/\s/g, '');
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    return 'left';
  });

  // Parse data rows
  const rows = lines.slice(2).map(parseRow);

  // Validate that rows have consistent column count
  const columnCount = headers.length;
  const validRows = rows.filter((row) => row.length === columnCount);

  if (validRows.length === 0 && rows.length > 0) {
    return null; // Inconsistent column counts
  }

  return { type: 'table', headers, rows: validRows, alignments };
}

/**
 * Extract fenced code blocks from content
 * Returns matches with their positions for reconstruction
 */
interface CodeMatch {
  start: number;
  end: number;
  language: string;
  content: string;
}

function extractCodeBlocks(content: string): CodeMatch[] {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const matches: CodeMatch[] = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      language: match[1] || 'text',
      content: match[2].trim(),
    });
  }

  return matches;
}

/**
 * Detect if a table block exists in text
 * Matches pipe-delimited tables with header separator
 */
interface TableMatch {
  start: number;
  end: number;
  content: string;
}

function extractTables(content: string): TableMatch[] {
  const lines = content.split('\n');
  const matches: TableMatch[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Check if line looks like a table header (has pipes)
    if (line.includes('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      // Check if next line is a separator row
      if (/^[|\s\-:]+$/.test(nextLine.trim()) && nextLine.includes('-')) {
        // Found potential table start
        const tableLines = [line, nextLine];
        let j = i + 2;

        // Collect remaining table rows
        while (j < lines.length && lines[j].includes('|')) {
          tableLines.push(lines[j]);
          j++;
        }

        if (tableLines.length >= 2) {
          // Calculate positions
          const beforeTable = lines.slice(0, i).join('\n');
          const start = beforeTable.length + (i > 0 ? 1 : 0);
          const tableContent = tableLines.join('\n');
          const end = start + tableContent.length;

          matches.push({
            start,
            end,
            content: tableContent,
          });

          i = j;
          continue;
        }
      }
    }
    i++;
  }

  return matches;
}

/**
 * Main parser: converts raw message content into structured blocks
 */
export function parseMessageContent(content: string): ContentBlock[] {
  if (!content || content.trim() === '') {
    return [];
  }

  const blocks: ContentBlock[] = [];
  const codeMatches = extractCodeBlocks(content);
  const tableMatches = extractTables(content);

  // Combine and sort all special blocks by position
  const allMatches = [
    ...codeMatches.map((m) => ({ ...m, type: 'code' as const })),
    ...tableMatches.map((m) => ({ ...m, type: 'table' as const })),
  ].sort((a, b) => a.start - b.start);

  // Filter out overlapping matches (code blocks take precedence)
  const filteredMatches: typeof allMatches = [];
  for (const match of allMatches) {
    const overlaps = filteredMatches.some(
      (existing) =>
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end) ||
        (match.start <= existing.start && match.end >= existing.end)
    );
    if (!overlaps) {
      filteredMatches.push(match);
    }
  }

  // Build blocks array
  let currentPos = 0;

  for (const match of filteredMatches) {
    // Add text before this match
    if (match.start > currentPos) {
      const textContent = content.slice(currentPos, match.start).trim();
      if (textContent) {
        blocks.push({ type: 'text', content: textContent });
      }
    }

    // Add the special block
    if (match.type === 'code') {
      const codeMatch = match as CodeMatch & { type: 'code' };
      blocks.push({
        type: 'code',
        language: codeMatch.language,
        content: codeMatch.content,
      });
    } else {
      const parsedTable = parseMarkdownTable(match.content);
      if (parsedTable) {
        blocks.push(parsedTable);
      } else {
        // Fallback to text if table parsing fails
        blocks.push({ type: 'text', content: match.content });
      }
    }

    currentPos = match.end;
  }

  // Add remaining text after last match
  if (currentPos < content.length) {
    const textContent = content.slice(currentPos).trim();
    if (textContent) {
      blocks.push({ type: 'text', content: textContent });
    }
  }

  // If no special blocks were found, return entire content as text
  if (blocks.length === 0) {
    blocks.push({ type: 'text', content: content.trim() });
  }

  return blocks;
}

/**
 * Detect if content is likely SQL
 */
export function detectSql(code: string): boolean {
  const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|CREATE|ALTER|DROP|INDEX|TABLE)\b/i;
  return sqlKeywords.test(code);
}

/**
 * Get the total character count of content for collapsible threshold
 */
export function getContentLength(content: string): number {
  return content.length;
}

/**
 * Get line count of content
 */
export function getLineCount(content: string): number {
  return content.split('\n').length;
}
