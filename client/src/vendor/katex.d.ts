// KaTeX 0.16 (MIT), vendored so worksheets can show real maths (stacked fractions, roots, exponents)
// without a package install. The stylesheet and fonts are in client/public/vendor/katex/.
declare module "@/vendor/katex.mjs" {
  const katex: { renderToString(tex: string, opts?: { throwOnError?: boolean; displayMode?: boolean; output?: "html" | "mathml" | "htmlAndMathml"; strict?: boolean | string }): string };
  export default katex;
}
