import { safeLine } from "../../lib/safeText";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface CodeBlock {
  type: "code";
  lang: string | null;
  text: string;
}

export type AnswerBlock = TextBlock | CodeBlock;

export function parseAnswerBlocks(rawText: string): AnswerBlock[] {
  if (!rawText) return [];

  const text = safeLine(rawText);
  const blocks: AnswerBlock[] = [];
  const lines = text.split("\n");

  let inCode = false;
  let currentLang: string | null = null;
  let currentCodeLines: string[] = [];
  let currentTextLines: string[] = [];

  const flushText = () => {
    if (currentTextLines.length > 0) {
      const content = currentTextLines.join("\n").trim();
      if (content.length > 0) {
        blocks.push({ type: "text", text: content });
      }
      currentTextLines = [];
    }
  };

  const flushCode = () => {
    blocks.push({
      type: "code",
      lang: currentLang,
      text: currentCodeLines.join("\n"),
    });
    currentCodeLines = [];
    currentLang = null;
    inCode = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.trim().match(/^```([a-zA-Z0-9_-]*)$/);

    if (fenceMatch) {
      if (!inCode) {
        // Opening code fence
        flushText();
        inCode = true;
        currentLang = fenceMatch[1] || null;
      } else {
        // Closing code fence
        flushCode();
      }
    } else {
      if (inCode) {
        currentCodeLines.push(line);
      } else {
        currentTextLines.push(line);
      }
    }

    if (blocks.length >= 60) {
      break;
    }
  }

  // Handle unclosed code fence: treated as code until the end
  if (inCode) {
    flushCode();
  } else {
    flushText();
  }

  return blocks.slice(0, 60);
}
