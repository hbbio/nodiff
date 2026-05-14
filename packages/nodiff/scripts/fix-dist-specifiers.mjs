import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(packageRoot, "dist");

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function hasExtension(specifier) {
  return extname(specifier) !== "";
}

function rewriteSpecifier(file, specifier, targetExtension) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return specifier;
  if (hasExtension(specifier)) return specifier;

  const target = resolve(dirname(file), `${specifier}${targetExtension}`);
  return existsSync(target) ? `${specifier}.js` : specifier;
}

function rewriteText(file, text, targetExtension) {
  let next = text.replace(
    /(\bfrom\s+)(["'])(\.{1,2}\/[^"']+)\2/g,
    (_match, prefix, quote, specifier) =>
      `${prefix}${quote}${rewriteSpecifier(file, specifier, targetExtension)}${quote}`,
  );

  next = next.replace(
    /(\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g,
    (_match, prefix, quote, specifier) =>
      `${prefix}${quote}${rewriteSpecifier(file, specifier, targetExtension)}${quote}`,
  );

  return next.replace(
    /(\bimport\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2(\s*\))/g,
    (_match, prefix, quote, specifier, suffix) =>
      `${prefix}${quote}${rewriteSpecifier(file, specifier, targetExtension)}${quote}${suffix}`,
  );
}

for (const file of walk(distRoot)) {
  const targetExtension = file.endsWith(".d.ts") ? ".d.ts" : file.endsWith(".js") ? ".js" : null;
  if (!targetExtension) continue;

  const text = readFileSync(file, "utf8");
  const next = rewriteText(file, text, targetExtension);
  if (next !== text) writeFileSync(file, next);
}
