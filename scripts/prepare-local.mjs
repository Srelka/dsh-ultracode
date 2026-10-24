import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const source = fileURLToPath(new URL("../", import.meta.url));
const publicName = "@srelka/dsh-ultracode";
const localName = "@local/dsh-ultracode";

// package.json is the file/version authority for both npm pack and local installs.
export function localFiles() {
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
  const files = new Map();
  function include(relative) {
    const name = relative.split(path.sep).join("/");
    if (fs.statSync(path.join(source, name)).isDirectory()) {
      for (const child of fs.readdirSync(path.join(source, name))) include(path.join(name, child));
      return;
    }
    const bytes = fs.readFileSync(path.join(source, name));
    files.set(name, /\.(js|json|yml|md)$/.test(name)
      ? Buffer.from(bytes.toString("utf8").replaceAll(publicName, localName)) : bytes);
  }
  for (const name of fs.globSync([...manifest.files, "package.json", "package-lock.json", "README.md"], { cwd: source })) include(name);
  const localManifest = JSON.parse(files.get("package.json").toString());
  delete localManifest.scripts; // Tests and developer scripts are not installed runtime files.
  files.set("package.json", Buffer.from(JSON.stringify(localManifest, null, 2) + "\n"));
  return files;
}

export function prepareLocal(destination, { check = false } = {}) {
  const target = path.resolve(destination);
  const relative = path.relative(source, target);
  if (!relative || (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)))
    throw new Error("Local output must be outside the source checkout.");
  const files = localFiles(), mismatches = [];
  for (const [name, content] of files) {
    const file = path.join(target, name);
    if (check) {
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) mismatches.push(name);
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  }
  // Keep node_modules and unrelated local documents; no directory deletion.
  return { files: files.size, mismatches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), check = args[0] === "--check";
  const destination = args[check ? 1 : 0];
  if (!destination || args.length !== (check ? 2 : 1))
    throw new Error("Usage: node scripts/prepare-local.mjs [--check] <output-directory>");
  const result = prepareLocal(destination, { check });
  console.log(JSON.stringify(result));
  if (result.mismatches.length) process.exitCode = 1;
}
