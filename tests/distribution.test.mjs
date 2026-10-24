import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareLocal, localFiles } from "../scripts/prepare-local.mjs";

test("local distribution derives all shipped files and version from the public source", () => {
  const files = localFiles();
  const pkg = JSON.parse(files.get("package.json")), lock = JSON.parse(files.get("package-lock.json"));
  const source = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(pkg.name, "@local/dsh-ultracode");
  assert.equal(pkg.version, source.version); assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].name, pkg.name);
  assert.ok(files.has("diagnostics.js")); assert.ok(files.has("inherit.js"));
  assert.ok(files.has("locale/zh.json"));
  assert.ok(files.has("docs/images/ultracode-light.jpg"));
  assert.ok(![...files.keys()].some(p => /^(node_modules|tests|scripts|\.git)[/\\]/.test(p)));
  assert.ok(files.get("cordis.patch.yml").toString().includes("@local/dsh-ultracode"));
});

test("generation is repeatable, detects drift and preserves unrelated local files", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "ultracode-distribution-"));
  try {
    fs.writeFileSync(path.join(target,"local-note.txt"),"keep");
    prepareLocal(target);
    assert.deepEqual(prepareLocal(target,{check:true}).mismatches,[]);
    fs.appendFileSync(path.join(target,"client.js"),"\n// drift");
    assert.deepEqual(prepareLocal(target,{check:true}).mismatches,["client.js"]);
    prepareLocal(target);
    assert.deepEqual(prepareLocal(target,{check:true}).mismatches,[]);
    assert.equal(fs.readFileSync(path.join(target,"local-note.txt"),"utf8"),"keep");
    assert.throws(()=>prepareLocal(fileURLToPath(new URL("../",import.meta.url))), /outside/);
  } finally { fs.rmSync(target,{recursive:true,force:true}); }
});
