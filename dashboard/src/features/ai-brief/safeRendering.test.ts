import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getFilesRecursively(fullPath, fileList);
    } else if (/\.(tsx?|jsx?)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('safe rendering verification', () => {
  const targetDirs = [
    path.resolve(__dirname), // src/features/ai-brief
    path.resolve(__dirname, '../post-project'),
    path.resolve(__dirname, '../review'),
  ];

  const allFiles = targetDirs.flatMap((dir) => getFilesRecursively(dir));

  it('scans all target feature files and finds no forbidden rendering methods', () => {
    expect(allFiles.length).toBeGreaterThan(0);

    const violations: { file: string; rule: string; line: number; text: string }[] = [];

    const markdownPatterns = ['react-markdown', 'marked', 'remark', 'markdown-it'];

    for (const filePath of allFiles) {
      // Skip test files themselves
      if (filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;

        // Check for dangerouslySetInnerHTML
        if (line.includes('dangerouslySetInnerHTML')) {
          violations.push({
            file: filePath,
            rule: 'dangerouslySetInnerHTML is strictly forbidden',
            line: lineNum,
            text: line.trim(),
          });
        }

        // Check for innerHTML
        if (/\.innerHTML\b/.test(line)) {
          violations.push({
            file: filePath,
            rule: 'innerHTML is strictly forbidden',
            line: lineNum,
            text: line.trim(),
          });
        }

        // Check for markdown parser imports
        for (const mdPkg of markdownPatterns) {
          if (line.includes(`from '${mdPkg}'`) || line.includes(`from "${mdPkg}"`)) {
            violations.push({
              file: filePath,
              rule: `Markdown library import (${mdPkg}) is forbidden`,
              line: lineNum,
              text: line.trim(),
            });
          }
        }

        // Check for dynamic <a> href coming from AI data (e.g. href={file.path} or href={brief.})
        if (/<a\s+[^>]*href=\{[^}]*(?:brief|suspected|file\.path)[^}]*\}/.test(line)) {
          violations.push({
            file: filePath,
            rule: 'Dynamic <a> link from AI data is forbidden',
            line: lineNum,
            text: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      console.error('Safe rendering violations found:', violations);
    }
    expect(violations).toEqual([]);
  });
});
