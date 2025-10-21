# Build & Setup Instructions

These steps explain how to install and run the `mcp-echo-env` server when you
are preparing it for local testing or packaging.

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) for dependency management

## Install dependencies

```bash
pnpm install
```

## Run the server from the project root

```bash
mcp-server-echo-env
```

The command logs one readiness message and then waits for MCP traffic on
stdio.

## Global installation / distribution

The package exposes a CLI binary named `mcp-server-echo-env`. To make it
available system-wide:

```bash
# From the project root
pnpm install --global .

# Verify that the binary is on your PATH
which mcp-server-echo-env
```

For ephemeral runs without installation you can execute
`pnpm dlx mcp-server-echo-env` from any workspace. After this package is
published you will be able to run `npx mcp-server-echo-env` for the same effect.
As an alternative, invoke the script directly with `node path/to/index.js`.

## Quick verification (no MCP client)

You can exercise the core logic directly:

```bash
WORKSPACE_SLUG=demo node --input-type=module <<'NODE'
import { collectEnvironmentVariables } from './index.js';
console.log(
  JSON.stringify(
    collectEnvironmentVariables(['PWD', 'WORKSPACE_SLUG']),
    null,
    2
  )
);
NODE
```

This prints the selected variables exactly as the MCP tool would expose them.

Refer back to `README.md` for the purpose of this repository and user-facing
usage examples.
