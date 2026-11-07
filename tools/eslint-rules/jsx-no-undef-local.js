// JSX-এ <Foo /> লেখা কিন্তু Foo import/declare করা নেই — এটা ধরে (ডিভাইসে হোম-ক্র্যাশ হওয়ার আগে CI-তেই)।
// একই সাথে JSX-এ ব্যবহৃত component-কে "ব্যবহৃত" চিহ্নিত করে, তাই no-unused-vars-এর ভুয়া সতর্কতা কমে।
// কোনো বাইরের plugin/dependency লাগে না। ESLint 8: `--rulesdir tools/eslint-rules` দিয়ে লোড হয়।
// (CommonJS রাখতে এই ফোল্ডারের package.json-এ "type":"commonjs" আছে।)
"use strict";

module.exports = {
  meta: {
    type: "problem",
    schema: [],
    messages: { undef: "'{{name}}' JSX-এ ব্যবহৃত হয়েছে কিন্তু import/declare করা নেই।" }
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        let n = node.name;
        while (n && n.type === "JSXMemberExpression") n = n.object;
        if (!n || n.type !== "JSXIdentifier") return;
        const name = n.name;
        // ছোট হাতের নাম (div, span…) = HTML tag, `this` ইত্যাদি বাদ
        if (!/^[A-Z_$]/.test(name)) return;
        let scope = context.getScope();
        while (scope) {
          if (scope.set.has(name)) {
            context.markVariableAsUsed(name);
            return;
          }
          scope = scope.upper;
        }
        context.report({ node: n, messageId: "undef", data: { name } });
      }
    };
  }
};
