// Custom rules backing ARCHITECTURE.md §3.2 (token enforcement) and §11 (secret boundary).

const BRACKET_GROUP = /\[([^\]]+)\]/g;
// Tailwind encodes spaces inside arbitrary values as `_`, which is a word
// character, so `\b` cannot be used to anchor the colour functions.
const RAW_COLOUR =
  /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])|(?<![a-zA-Z0-9])(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;
const RAW_PIXEL = /\d*\.?\d+px\b/;

const noRawDesignValues = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw colour and pixel values inside Tailwind arbitrary values.",
    },
    schema: [],
    messages: {
      rawColour:
        "Raw colour `{{value}}` in an arbitrary value. Use a colour token (DESIGN.md §3).",
      rawPixel:
        "Raw pixel value `{{value}}` in an arbitrary value. Use a spacing, radius or type token (DESIGN.md §4-5).",
    },
  },
  create(context) {
    function report(node, text) {
      BRACKET_GROUP.lastIndex = 0;

      let match = BRACKET_GROUP.exec(text);

      while (match !== null) {
        const value = match[1];

        if (RAW_COLOUR.test(value)) {
          context.report({ node, messageId: "rawColour", data: { value } });
        } else if (RAW_PIXEL.test(value)) {
          context.report({ node, messageId: "rawPixel", data: { value } });
        }

        match = BRACKET_GROUP.exec(text);
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") {
          report(node, node.value);
        }
      },
      TemplateElement(node) {
        if (typeof node.value.cooked === "string") {
          report(node, node.value.cooked);
        }
      },
    };
  },
};

const noServerEnvOutsideServer = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow non-public environment variable access outside server modules.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      serverEnv:
        "`{{name}}` is server-only. Only NEXT_PUBLIC_* may be read outside server/ (ARCHITECTURE.md §11).",
      dynamicEnv:
        "Dynamic process.env access cannot be verified as public. Read it from server/ instead (ARCHITECTURE.md §11).",
    },
  },
  create(context) {
    const allowed = new Set(context.options[0]?.allow ?? ["NODE_ENV"]);

    function isProcessEnv(node) {
      return (
        node.type === "MemberExpression" &&
        !node.computed &&
        node.object.type === "Identifier" &&
        node.object.name === "process" &&
        node.property.type === "Identifier" &&
        node.property.name === "env"
      );
    }

    function reportName(node, name) {
      if (!name.startsWith("NEXT_PUBLIC_") && !allowed.has(name)) {
        context.report({ node, messageId: "serverEnv", data: { name } });
      }
    }

    return {
      MemberExpression(node) {
        if (!isProcessEnv(node.object)) {
          return;
        }

        if (!node.computed) {
          if (node.property.type === "Identifier") {
            reportName(node, node.property.name);
          }

          return;
        }

        if (
          node.property.type === "Literal" &&
          typeof node.property.value === "string"
        ) {
          reportName(node, node.property.value);
          return;
        }

        context.report({ node, messageId: "dynamicEnv" });
      },
    };
  },
};

export const rules = {
  "no-raw-design-values": noRawDesignValues,
  "no-server-env-outside-server": noServerEnvOutsideServer,
};

export const apexoria = { rules };

export default apexoria;
