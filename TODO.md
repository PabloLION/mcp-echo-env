# Project TODOs

- [ ] Add automated smoke test (e.g., Node script using `@modelcontextprotocol/sdk`
      client) to call `env_echo` and assert the returned payload contains `tool`
      and `variables` keys.
- [ ] Wire up a GitHub Actions workflow for lint, markdownlint, and the smoke
      test so publishing stays reliable.
- [ ] Document usage with additional MCP clients (e.g., Playwright MCP, Gina)
      to broaden coverage beyond Codex CLI.
- [ ] Revisit optional structured output schema once Zod conversion issues are
      resolved, enabling clients to rely on typed `variables` data.
- [ ] Explore lightweight logging controls or verbosity flags for noisy
      environments.
- [ ] Add guidance for testing custom environment variables via `.env` files in
      multi-workspace setups (screenshots or a short walkthrough).
