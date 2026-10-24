import { parse } from "acorn";

function literal(node) {
  if (node.type === "Literal" && (node.value === null || ["string", "boolean", "number"].includes(typeof node.value))) return node.value;
  if (node.type === "ArrayExpression") return node.elements.map(literal);
  if (node.type === "ObjectExpression") {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (property.type !== "Property" || property.computed || property.method || property.kind !== "init" || property.shorthand)
        throw new Error("Workflow meta must contain only literal properties.");
      const key = property.key.type === "Identifier" ? property.key.name : literal(property.key);
      if (typeof key !== "string" || Object.hasOwn(result, key)) throw new Error("Invalid or duplicate workflow meta key.");
      result[key] = literal(property.value);
    }
    return result;
  }
  throw new Error("Workflow meta must be a literal object; expressions and code are not executed.");
}

export function parseScriptFile(source) {
  if (Buffer.byteLength(source, "utf8") > 256 * 1024) throw new Error("Workflow script exceeds 256 KiB.");
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module", allowReturnOutsideFunction: true });
  const first = ast.body[0];
  const declaration = first?.declaration;
  if (first?.type !== "ExportNamedDeclaration" || declaration?.kind !== "const" || declaration.declarations.length !== 1 || declaration.declarations[0].id.name !== "meta")
    throw new Error("Workflow file must begin with export const meta = { name, description, phases? }; followed by its JavaScript body.");
  const meta = literal(declaration.declarations[0].init);
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type?.startsWith("Import") || node.type?.startsWith("Export")) throw new Error("Workflow body cannot import or export modules.");
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === "object") visit(value);
  };
  ast.body.slice(1).forEach(visit);
  return { meta, script: source.slice(first.end) };
}

export async function resolveScriptFile(ctx, agent, path, signal) {
  if (!agent.ctx.tools.get("read", agent)) throw new Error("The current preset does not permit reading script files.");
  const cwd = await ctx.workingDirectory.ensure(agent, signal);
  const target = await ctx.fs.resolve(path, { cwd, signal });
  const stat = await ctx.fs.stat(target, signal);
  if (!stat || stat.type !== "file") throw new Error("Workflow script_path must be an existing regular file.");
  if (stat.size > 256 * 1024) throw new Error("Workflow script exceeds 256 KiB.");
  const source = await ctx.fs.readText(target, signal);
  signal.throwIfAborted();
  return { ...parseScriptFile(source), path: ctx.fs.processPath(target) };
}
