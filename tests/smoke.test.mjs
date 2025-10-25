import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const serverEntry = resolve(projectRoot, "index.js");

test("env_echo returns expected variables", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: projectRoot,
    env: {
      ...process.env,
      WORKSPACE_SLUG: "smoke-test-workspace",
      MCP_ECHO_ENV_LOG_LEVEL: "error",
    },
    stderr: "pipe",
  });

  const logs = [];
  const stderrStream = transport.stderr;
  if (stderrStream) {
    stderrStream.setEncoding("utf8");
    stderrStream.on("data", (chunk) => {
      logs.push(chunk);
    });
  }

  const client = new Client({
    name: "mcp-echo-env-smoke-test",
    version: "1.0.0",
  });

  t.after(async () => {
    await client.close();
  });

  await client.connect(transport);
  await client.listTools({});

  const { structuredContent, isError } = await client.callTool({
    name: "env_echo",
    arguments: {},
  });

  assert.equal(Boolean(isError), false, "Tool call should succeed");
  assert.ok(structuredContent, "Structured content should be present");
  assert.equal(structuredContent.tool, "env_echo");
  assert.ok(structuredContent.variables, "variables map should exist");
  assert.equal(
    structuredContent.variables.WORKSPACE_SLUG,
    "smoke-test-workspace"
  );
  assert.equal(
    structuredContent.variables.PWD,
    projectRoot,
    `${JSON.stringify(structuredContent, null, 2)}\nLogs:\n${logs.join("")}`
  );
  assert.deepEqual(
    Object.keys(structuredContent.variables).sort(),
    ["PWD", "WORKSPACE_SLUG"]
  );
});
