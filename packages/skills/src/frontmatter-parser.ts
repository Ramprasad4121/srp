import { parse } from "yaml";

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  content: string;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)---\s*\n?/;

/**
 * Parses markdown content to extract frontmatter and content
 * @param markdown The raw markdown content
 * @returns Object containing parsed frontmatter and content without frontmatter
 */
export function parseFrontmatter(markdown: string): ParsedMarkdown {
  const match = markdown.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      frontmatter: {},
      content: markdown,
    };
  }

  const frontmatterText = match[1] || "";
  const content = markdown.slice(match[0].length);

  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed = parse(frontmatterText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      frontmatter = parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("Failed to parse YAML frontmatter:", error);
  }

  return {
    frontmatter,
    content,
  };
}
