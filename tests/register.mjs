// Lets `node --test` import the app's TypeScript modules directly: Node 24
// strips the types, and this resolves the two things Next resolves for us —
// extensionless relative imports and JSON imports. No dependency.
//   node --import ./tests/register.mjs --test "tests/*.test.mjs"
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    const withJson = (s) => {
      const r = next(s, context);
      return s.endsWith(".json") ? { ...r, importAttributes: { type: "json" } } : r;
    };
    try {
      return withJson(specifier);
    } catch (err) {
      if (/^(\.{1,2}\/|file:)/.test(specifier)) {
        for (const ext of [".ts", ".tsx"]) {
          try {
            return withJson(specifier + ext);
          } catch {
            // try the next extension
          }
        }
      }
      throw err;
    }
  },
});
