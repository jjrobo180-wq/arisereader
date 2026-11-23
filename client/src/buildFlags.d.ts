// Set at build time (vite.config.ts: false; vite.todo.config.ts: true). True only in the Arise To Duo
// iPhone app's own build, which leaves out the other products. Always read it as
// (typeof __TODO_APP__ !== "undefined" && __TODO_APP__), so code also runs where it isn't set (tests).
declare const __TODO_APP__: boolean | undefined;
