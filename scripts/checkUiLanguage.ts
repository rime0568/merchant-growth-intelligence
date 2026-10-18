import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const sourceRoot = join(process.cwd(), "src");
const chineseCharacter = /[\u3400-\u9fff]/;
const sourceFiles: string[] = [];

function collect(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith("generatedData.ts")) sourceFiles.push(path);
  }
}

collect(sourceRoot);
const findings = sourceFiles.flatMap((file) => readFileSync(file, "utf8").split(/\r?\n/).flatMap((line, index) => chineseCharacter.test(line) ? [`${relative(process.cwd(), file)}:${index + 1}`] : []));

if (findings.length) {
  console.error("Chinese characters found in rendered UI source files:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`English-only UI validation passed across ${sourceFiles.length} source files.`);
