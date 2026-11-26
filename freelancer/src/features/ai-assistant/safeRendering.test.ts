import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("security / safeRendering guard", () => {
  const targetDirs = [
    path.resolve(__dirname, "../../features/ai-assistant"),
    path.resolve(__dirname, "../../features/task"),
    path.resolve(__dirname, "../../features/dock"),
    path.resolve(__dirname, "../../features/submission"),
  ];

  const forbiddenPatterns = [
    { pattern: /dangerouslySetInnerHTML/g, name: "dangerouslySetInnerHTML" },
    { pattern: /\.innerHTML\s*=/g, name: "innerHTML assignment" },
    { pattern: /from\s+['"](react-markdown|marked|showdown|remark|micromark|dompurify)['"]/g, name: "markdown renderer" },
  ];

  function getFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getFiles(fullPath));
      } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("ensures no dangerous HTML rendering or markdown parsers are used in AI and workspace features", () => {
    const allFiles = targetDirs.flatMap(getFiles);
    expect(allFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const { pattern, name } of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(process.cwd(), filePath)} uses ${name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
