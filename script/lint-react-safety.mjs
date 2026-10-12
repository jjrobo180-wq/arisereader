// Catches the runtime mistakes that type-checking and bundling both let through:
//
//   1. a hook (useState, useEffect, useMemo…) called below an early return, so a component
//      runs a different number of hooks on different renders and React throws;
//   2. a const or let read earlier in a function than it is declared, which throws a
//      ReferenceError the moment that line runs;
//   3. a <Component /> that is never imported or declared in its file. esbuild treats an unknown
//      capitalised name as a global rather than an error, so the bundle builds clean and the page
//      dies the moment that element renders. An icon added to a menu without adding it to the
//      lucide-react import is the usual way in.
//
// All three shipped broken pages in October 2026. Run with: npm run lint:safety
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "client/src");
const HOOK = /^use[A-Z]/;

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const problems = [];
const report = (file, node, src, message) => {
  const { line } = src.getLineAndCharacterOfPosition(node.getStart(src));
  problems.push({ file: relative(ROOT, file), line: line + 1, message });
};

/** The statements directly inside a function body, skipping anything in a nested function. */
const isTypeNode = (n) => n.kind >= ts.SyntaxKind.FirstTypeNode && n.kind <= ts.SyntaxKind.LastTypeNode;
const isFunctionLike = (n) =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

function walkOwnScope(node, visit) {
  node.forEachChild(function step(child) {
    if (isFunctionLike(child)) return;
    visit(child);
    child.forEachChild(step);
  });
}

function checkBody(body, file, src) {
  if (!body || !ts.isBlock(body)) return;

  // --- 1. hooks below an early return ---
  let returnedAt = -1;
  body.statements.forEach((stmt, i) => {
    if (returnedAt === -1) {
      let hasReturn = ts.isReturnStatement(stmt);
      if (!hasReturn && ts.isIfStatement(stmt)) {
        walkOwnScope(stmt, (n) => { if (ts.isReturnStatement(n)) hasReturn = true; });
      }
      if (hasReturn && i < body.statements.length - 1) returnedAt = i;
      return;
    }
    walkOwnScope(stmt, (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && HOOK.test(n.expression.text)) {
        report(file, n, src, `${n.expression.text}() is called below an early return — React needs the same hooks every render`);
      }
    });
  });

  // --- 2. a const or let read above its own declaration ---
  const declared = new Map();
  for (const stmt of body.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    if (!(stmt.declarationList.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let))) continue;
    for (const d of stmt.declarationList.declarations) {
      const names = [];
      const collect = (name) => {
        if (ts.isIdentifier(name)) names.push(name.text);
        else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
          for (const el of name.elements) if (ts.isBindingElement(el)) collect(el.name);
        }
      };
      collect(d.name);
      for (const n of names) if (!declared.has(n)) declared.set(n, d.getStart(src));
    }
  }
  // Only statements sitting directly in the function body are checked, and nested braces are
  // left alone: an inner block may declare its own copy of the name, which is legal and was
  // the source of every false alarm when this walked the whole subtree.
  const flagReads = (node) => {
    node.forEachChild(function step(child) {
      // Type positions name nothing at runtime: useRef<{ user: X }>() is not a read of `user`.
      if (isFunctionLike(child) || ts.isBlock(child) || isTypeNode(child)) return;
      if (ts.isIdentifier(child)) {
        const at = declared.get(child.text);
        const p = child.parent;
        // A name in one of these positions is a label, not a read of the variable. JSX attributes
        // are the subtle one: `title="Class"` is an attribute called title, and flagging it as a
        // read of a `const title` declared further down was a false alarm.
        const isName = (ts.isPropertyAccessExpression(p) && p.name === child)
          || (ts.isPropertyAssignment(p) && p.name === child)
          || (ts.isJsxAttribute(p) && p.name === child)
          || ts.isJsxSelfClosingElement(p) || ts.isJsxOpeningElement(p) || ts.isJsxClosingElement(p)
          || ts.isBindingElement(p) || ts.isVariableDeclaration(p);
        if (at !== undefined && child.getStart(src) < at && !isName) {
          report(file, child, src, `"${child.text}" is read here but declared further down — that throws at runtime`);
        }
      }
      child.forEachChild(step);
    });
  };
  for (const stmt of body.statements) flagReads(stmt);
}

/** --- 3. a <Component /> nothing in this file defines ---
 *  Every name bound anywhere in the file is collected first (imports, functions, variables,
 *  classes, enums, parameters), then each capitalised JSX tag is checked against it. Lower-case
 *  tags are HTML, and a dotted tag (<Foo.Bar />) is checked on its leftmost name only. */
function checkUndefinedComponents(src, file) {
  const bound = new Set(["React", "Fragment"]);
  const bind = (name) => {
    if (!name) return;
    if (ts.isIdentifier(name)) bound.add(name.text);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) if (ts.isBindingElement(el)) bind(el.name);
    }
  };
  const collect = (node) => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      if (node.importClause.name) bound.add(node.importClause.name.text);
      const nb = node.importClause.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) bound.add(nb.name.text);
      if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) bound.add(e.name.text);
    }
    if (ts.isImportEqualsDeclaration(node)) bound.add(node.name.text);
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) bound.add(node.name.text);
    if (ts.isVariableDeclaration(node)) bind(node.name);
    if (ts.isParameter(node)) bind(node.name);
    node.forEachChild(collect);
  };
  collect(src);

  const check = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      let tag = node.tagName;
      while (ts.isPropertyAccessExpression(tag)) tag = tag.expression;
      if (ts.isIdentifier(tag) && /^[A-Z]/.test(tag.text) && !bound.has(tag.text)) {
        report(file, tag, src, `<${tag.text}> is used here but never imported or defined in this file — the bundle builds, then the page crashes when it renders`);
      }
    }
    node.forEachChild(check);
  };
  check(src);
}

for (const file of files(SRC)) {
  const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (isFunctionLike(node)) checkBody(node.body, file, src);
    node.forEachChild(visit);
  };
  visit(src);
  checkUndefinedComponents(src, file);
}

if (problems.length) {
  for (const p of problems) console.error(`${p.file}:${p.line}  ${p.message}`);
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"} found.`);
  process.exit(1);
}
console.log("No hook-order or use-before-declaration problems found.");
