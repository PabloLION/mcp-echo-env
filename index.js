#!/usr/bin/env node

import process from "node:process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_KEYS = ["PWD", "WORKSPACE_SLUG"];

export const inputSchema = {
  keys: z
    .array(
      z
        .string()
        .min(1, "Environment variable names must be at least one character.")
        .describe("Name of an environment variable to echo.")
    )
    .nonempty()
    .optional()
    .describe(
      "List of environment variables to read. Defaults to PWD and WORKSPACE_SLUG."
    ),
  omitNull: z
    .boolean()
    .optional()
    .describe("When true, variables with no value are excluded from the result."),
};

export const outputSchema = {
  tool: z.literal("env_echo"),
  variables: z
    .record(z.string().nullish())
    .describe("Key/value pairs for each echoed environment variable."),
};

export function collectEnvironmentVariables(keys, { omitNull = false } = {}) {
  const uniqueKeys = Array.from(new Set(keys));
  return uniqueKeys.reduce((acc, key) => {
    const value = process.env[key];
    if (value === undefined && omitNull) {
      return acc;
    }
    acc[key] = value ?? null;
    return acc;
  }, {});
}

function loadWorkspaceEnvFile() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }
  let contents;
  try {
    contents = readFileSync(envPath, "utf8");
  } catch (error) {
    console.error(`[mcp-echo-env] Failed to read ${envPath}:`, error);
    return;
  }
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [rawKey, ...rawValueParts] = line.split("=");
    if (!rawKey) {
      continue;
    }
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
}

loadWorkspaceEnvFile();

if (process.env.WORKSPACE_SLUG === undefined) {
  process.env.WORKSPACE_SLUG = basename(process.cwd());
}

if (process.env.PWD === undefined) {
  process.env.PWD = process.cwd();
}

const server = new McpServer(
  {
    name: "mcp-echo-env",
    version: "1.0.0",
  },
  {
    instructions:
      "Call the env_echo tool to inspect environment variables from the MCP server process.",
  }
);

server.registerTool(
  "env_echo",
  {
    title: "Environment Variable Echo",
    description:
      "Return the values of requested environment variables from the MCP server process.",
    inputSchema,
    outputSchema,
  },
  async ({ keys, omitNull = false }) => {
    const keysToUse = keys && keys.length > 0 ? keys : DEFAULT_KEYS;
    const omitNulls = Boolean(omitNull);
    const variables = collectEnvironmentVariables(keysToUse, {
      omitNull: omitNulls,
    });
    const structuredContent = {
      tool: "env_echo",
      variables,
    };
    const formatted = JSON.stringify(
      {
        ...structuredContent,
        workspace_slug: process.env.WORKSPACE_SLUG ?? null,
        pwd: process.env.PWD ?? null,
      },
      null,
      2
    );
    return {
      content: [
        {
          type: "text",
          text: formatted,
        },
      ],
      structuredContent,
    };
  }
);

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    "[mcp-echo-env] MCP server ready – awaiting client requests on stdio."
  );
  process.stdin.resume();

  await new Promise((resolve) => {
    const shutdown = () => resolve();
    transport.onclose = shutdown;
    transport.onerror = (error) => {
      console.error("[mcp-echo-env] Transport error:", error);
      shutdown();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });

  await server.close();
}

const isExecutedDirectly = (() => {
  const candidate = process.argv[1];
  if (!candidate) {
    return false;
  }
  try {
    return (
      realpathSync(candidate) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();

if (isExecutedDirectly) {
  startServer().catch((error) => {
    console.error("[mcp-echo-env] Fatal server error:", error);
    process.exit(1);
  });
}
