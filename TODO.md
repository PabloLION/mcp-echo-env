# Project TODOs

- [x] Add automated smoke test (see `tests/smoke.test.mjs`) to call `env_echo`
      with the SDK client and assert the returned payload contains `tool` and
      `variables` keys.
- [x] Wire up a GitHub Actions workflow for lint, markdownlint, and the smoke
      test so publishing stays reliable.
- [x] Document usage with additional MCP clients (Playwright MCP and Jina) to
      broaden coverage beyond Codex CLI.
- [x] Revisit optional structured output schema so clients can rely on typed
      `variables` data.
- [x] Explore lightweight logging controls or verbosity flags for noisy
      environments (`MCP_ECHO_ENV_LOG_LEVEL`).
- [x] Add guidance for testing custom environment variables via `.env` files in
      multi-workspace setups.
