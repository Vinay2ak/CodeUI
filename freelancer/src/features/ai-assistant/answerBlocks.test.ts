import { describe, it, expect } from "vitest";
import { parseAnswerBlocks } from "./answerBlocks";

describe("answerBlocks / parseAnswerBlocks", () => {
  it("handles empty input", () => {
    expect(parseAnswerBlocks("")).toEqual([]);
  });

  it("parses plain text without fences as a single text block", () => {
    const text = "This is a simple answer without any code.";
    const blocks = parseAnswerBlocks(text);
    expect(blocks).toEqual([{ type: "text", text }]);
  });

  it("keeps <script> string strictly as text and does not evaluate or produce HTML", () => {
    const evil = "<script>alert('xss')</script>";
    const blocks = parseAnswerBlocks(evil);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: "text", text: evil });
  });

  it("keeps markdown links as plain text", () => {
    const markdown = "Check the [documentation](javascript:alert(1)) here.";
    const blocks = parseAnswerBlocks(markdown);
    expect(blocks[0]).toEqual({ type: "text", text: markdown });
  });

  it("parses code blocks with language identifiers", () => {
    const input = "Here is the fix:\n```python\ndef retry():\n    return 5\n```\nAll done.";
    const blocks = parseAnswerBlocks(input);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: "text", text: "Here is the fix:" });
    expect(blocks[1]).toEqual({
      type: "code",
      lang: "python",
      text: "def retry():\n    return 5",
    });
    expect(blocks[2]).toEqual({ type: "text", text: "All done." });
  });

  it("treats an unclosed code fence as code until the end", () => {
    const input = "Intro\n```typescript\nconst x = 1;\nconst y = 2;";
    const blocks = parseAnswerBlocks(input);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "text", text: "Intro" });
    expect(blocks[1]).toEqual({
      type: "code",
      lang: "typescript",
      text: "const x = 1;\nconst y = 2;",
    });
  });

  it("handles two distinct code blocks in one answer", () => {
    const input = "```bash\npip install\n```\nThen run:\n```bash\npytest\n```";
    const blocks = parseAnswerBlocks(input);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: "code", lang: "bash", text: "pip install" });
    expect(blocks[1]).toEqual({ type: "text", text: "Then run:" });
    expect(blocks[2]).toEqual({ type: "code", lang: "bash", text: "pytest" });
  });

  it("caps blocks at 60 blocks", () => {
    const lines = Array.from({ length: 140 }, (_, i) => `Paragraph ${i}\n\n\`\`\`\ncode ${i}\n\`\`\``).join("\n");
    const blocks = parseAnswerBlocks(lines);
    expect(blocks.length).toBeLessThanOrEqual(60);
  });
});
