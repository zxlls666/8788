# BAW 8788 Local Development

- Independent repository: `/Users/serge/crypto/meme-bsc/baw-8788`; `origin` is `https://github.com/zxlls666/8788.git`.
- Follow the parent workspace instructions. Preserve boundaries with all other crypto projects and the immutable audit snapshot.
- Local security development is on `local/security-hardening`. Read `docs/security-hardening.md` before changing execution boundaries.
- Default to preview and fake-wallet tests. Do not pair a real wallet, read wallet credentials, broadcast a transaction, install the app/extension, or enable background startup without explicit user authorization.
- Use `node tests/run-safe.mjs` for regression checks; it uses temporary HOME/data and blocks external fetch/WebSocket. Do not run the trading scripts named `smoke`, `native-cycle`, `bridge-buy`, or similar against the user's environment.
- Use an explicit project-local `BAW_DATA_DIR` for any later authorized development run. Do not reuse another project's state or existing application identities.
- Existing ZIPs in `releases/` are unpatched upstream artifacts. Never describe them as containing local fixes. Rebuild and validate separately before distribution.
- Do not commit credentials, runtime data, budget ledgers, logs, dependencies, generated packages, or browser profiles. Do not push automatically.
