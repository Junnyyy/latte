# Latte development

Use Bun and the frozen `bun.lock` for installs, builds, tests, and type checks.

## macOS executable signing

The published v0.2.0 arm64 binary fails on macOS 27.0.1 with exit code 137.
Its SHA-256 is `b439f5bf84440cc8bb4b8c7da0c4eede3ad615de315f9a7a7b4069673328339c`.
`codesign --verify --strict` reports an invalid signature. The macOS crash report
records `SIGKILL (Code Signature Invalid)` and `CODESIGNING`, `Invalid Page`.
Replacing its signature with `codesign --force --sign -` makes the same binary
run `--version`, returning `0.2.0`, and `status` successfully.

Treat `zsh: killed` as a process termination symptom. Check the crash report and
signature before changing application code or assuming an SDK rebuild is needed.
Sign compiled macOS executables explicitly and verify the signature before use.
Test the compiled executable itself. Source execution and unit tests cannot prove
that macOS accepts its signature.

## Release boundaries

`bun run release patch` bumps the version, builds, commits, tags, pushes, and
publishes a GitHub release. Do not use it as a build-only diagnostic command.
Compile release candidates separately until publishing is authorized.

Preserve the `latte-darwin-arm64` and `latte-darwin-x64` asset names. The installer
selects those names directly. Before publishing, verify both signatures and run
both binaries. Running x64 binaries on Apple Silicon requires Rosetta.

The installer must verify that a downloaded binary starts and reports the
expected version before replacing an existing install. A release tag is not a
substitute for a successful executable version check.
