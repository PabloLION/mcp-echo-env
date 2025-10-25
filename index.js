#!/usr/bin/env node

import process from "node:process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_KEYS = ["PWD", "WORKSPACE_SLUG"];
const LOG_LEVELS = {
  silent: 0,
  error: 1,
  info: 2,
  debug: 3,
};

function resolveLogLevel(value) {
  const normalized = (value ?? "info").toLowerCase();
  if (LOG_LEVELS[normalized] !== undefined) {
    return normalized;
  }
  return "info";
}

let activeLogLevel = resolveLogLevel(process.env.MCP_ECHO_ENV_LOG_LEVEL);

function refreshLogLevel() {
  activeLogLevel = resolveLogLevel(process.env.MCP_ECHO_ENV_LOG_LEVEL);
}

const inputShape = {};

const outputShape = {
  tool: z.literal("env_echo"),
  variables: z
    .record(z.string(), z.union([z.string(), z.null()]))
    .describe("Key/value pairs for each echoed environment variable."),
};

const logger = {
  info: (...args) => {
    if (LOG_LEVELS[activeLogLevel] >= LOG_LEVELS.info) {
      console.error("[mcp-echo-env]", ...args);
    }
  },
  error: (...args) => {
    if (LOG_LEVELS[activeLogLevel] >= LOG_LEVELS.error) {
      console.error("[mcp-echo-env]", ...args);
    }
  },
  debug: (...args) => {
    if (LOG_LEVELS[activeLogLevel] >= LOG_LEVELS.debug) {
      console.error("[mcp-echo-env]", ...args);
    }
  },
};

export const inputSchema = z.object(inputShape).strict();

export const outputSchema = z.object(outputShape).strict();

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
    logger.error(`Failed to read ${envPath}:`, error);
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
refreshLogLevel();

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
      "Return the workspace path (PWD) and slug (WORKSPACE_SLUG) from the MCP server process.",
    inputSchema: inputShape,
    outputSchema: outputShape,
  },
  async (maybeArgs, maybeExtra) => {
    let args = maybeArgs;
    let extra = maybeExtra;
    if (extra === undefined) {
      extra = args;
      args = undefined;
    }
    const payload = args ?? {};
    const parseResult = inputSchema.safeParse(payload);
    if (!parseResult.success) {
      logger.error("Invalid arguments:", parseResult.error);
      return {
        content: [
          {
            type: "text",
            text: `Invalid arguments: ${parseResult.error.message}`,
          },
        ],
        isError: true,
      };
    }
    logger.debug("env_echo invoked", {
      sessionId: extra?.sessionId,
    });
    const variables = collectEnvironmentVariables(DEFAULT_KEYS);
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
    logger.debug("env_echo returning workspace snapshot.");
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
  logger.info("MCP server ready – awaiting client requests on stdio.");
  const shutdown = async () => {
    logger.info("Shutting down.");
    await server.close();
    process.exit(0);
  };
  transport.onerror = (error) => {
    logger.error("Transport error:", error);
    shutdown().catch((err) => {
      logger.error("Error during shutdown:", err);
      process.exit(1);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  // Keep the event loop active until a signal arrives.
  await new Promise(() => {});
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
    logger.error("Fatal server error:", error);
    process.exit(1);
  });
}
