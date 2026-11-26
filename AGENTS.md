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

## Verifying behavior

Use the `verify` skill in `.claude/skills/verify/` to drive the built binary and
capture evidence. Its feature map lists each user path and the output that proves it.

latte's only state is the system-wide `caffeinate` process. `latte off` and the
TUI stop every `caffeinate` the user owns, including ones latte did not start.
Never drive `on`, `off`, a duration, or the TUI while another `caffeinate` runs.

An agent session in T3 Code can have one such `caffeinate`. T3 Code started
`caffeinate -i -w <T3 Code PID>` to keep the Mac awake during the v0.4.1
release, and the `verify` helper then blocked every mutating drive. Run
`pgrep -lx caffeinate` before you plan a drive. Read-only checks still work:
`codesign --verify --strict`, `--version`, and `status`.

A `caffeinate` started from the TUI is in latte's process group. If latte is the
session leader of its terminal, a hangup kills that `caffeinate` too. Run latte
under a job-control shell in a PTY, as a terminal tab does, or quit-then-check
results are wrong.

Ink draws its first frame before it reads the keyboard. A key sent before then is
echoed as text and lost. Wait for a frame, then pause briefly before sending keys.

A PTY driver must keep reading output while it waits. Ink redraws the whole frame
on every key and every status tick. If nothing reads the PTY, the output buffer
fills, latte blocks writing stderr, and later keys arrive late in one chunk. Tcl
`sleep` in `expect` does not read. A bare Bun script that writes 2 KB to stderr
per key shows the same delay under `sleep` and none under a reading wait.

A TUI start runs `pkill`, then spawns `caffeinate`, and takes well under a second.
To drive a key sent while a start is in flight, put a `pkill` shim first on `PATH`
for the `pty` drive. The shim sleeps 3 seconds, then runs `/usr/bin/pkill "$@"`.
latte runs `ps`, `pgrep`, and `pkill` by bare name, so the shim takes effect.
Have the shim log each call, to prove the drive used it.

A TUI restart takes 140 to 148 ms, measured over 8 kill-and-start cycles through
`CaffeinateService`. The fixed 100 ms pause in `start()` is most of it. That is
fast enough for the dashboard to restart `caffeinate` on a settings key with no
progress indicator.

ink-testing-library frames carry no ANSI codes under `bun test`, so a unit test
cannot see color or dim text. Check styling in the PTY drive's
`transcript.raw`, where a dimmed `[x]` reads `\e[2m[x]`.

`caffeinate-before.txt` and `caffeinate-after.txt` right-align the PID, so most
lines start with a space. Match `^ *[0-9]+`, not `^[0-9]+`, or every line is
skipped and the check fails while latte is correct.

## Exit codes in tests

`fail` in `src/utils/exit.ts` sets `process.exitCode = 1`, and `bun test` exits
with that code even when every test passes. A test that runs a failing command
must reset the code afterwards. Bun 1.4.4 ignores `process.exitCode = undefined`,
so restoring an unset code leaves the 1 in place. Restore it with
`exitCode ?? 0`. Check `echo $?` after `bun test`, not only the pass count.
Run `bun test` without a pipe when you read the code. In zsh, `$PIPESTATUS` is
empty, and `$?` after a pipe is the last command's code.

## caffeinate assertions

Check a claim about a `caffeinate` flag with `pmset -g assertions` while the
process runs. Read the per-process `pid N(caffeinate)` lines. The global counts
include assertions from other apps.

Measured on macOS 27 on AC power:

- Without `-t`, `caffeinate -imsu` drops `UserIsActive` and `PreventDiskIdle`
  within 8 seconds. Only `PreventUserIdleSystemSleep` and `PreventSystemSleep`
  remain.
- With `-t 60`, the same flags hold all four assertions for the whole timeout.
- `caffeinate -d` holds only `PreventUserIdleDisplaySleep`.

The IOKit header `IOKit.framework/Headers/pwr_mgt/IOPMLib.h` in the SDK states
two more facts. While `PreventUserIdleDisplaySleep` holds, the system cannot
idle sleep. `PreventUserIdleSystemSleep` still allows sleep on lid close.

The presets in `src/utils/flags.ts` follow from these results. Keep `-u` out of
the presets, because its effect depends on whether the session has a timeout.

## Watching a process

`--while` passes one PID to `caffeinate -w`. Measured on macOS 27:

- `caffeinate` honors only the last `-w`. A second `-w` replaces the first.
- With `-t` as well, `caffeinate` exits at whichever comes first.
- With a PID that does not exist, `caffeinate` exits at once.

`ps -axo pid=,ppid=,comm=` prints the full executable path as `comm`. A symlinked
binary shows the symlink path, so the native Claude Code install reads as
`claude`. Claude Code started by the desktop app runs as
`claude.app/Contents/MacOS/claude`, and the desktop app itself as
`Claude.app/Contents/MacOS/Claude`. Match `claude` case-sensitively, or the
desktop app matches too.

## Release boundaries

Releases run only in the Release workflow, `.github/workflows/release.yml`.
Start it from the Actions tab or with `gh workflow run release.yml -f bump=patch`.
Do not start the workflow as a build-only diagnostic. Compile release
candidates with `scripts/build.sh` until publishing is authorized.

The workflow runs CI, then two jobs on `main`:

- `build` runs `scripts/release.sh build` on macOS. It bumps `package.json`,
  builds and checks both binaries, and writes `SHA256SUMS`. It uploads the
  binaries and `SHA256SUMS` as an artifact and commits nothing.
- `publish` runs `scripts/release.sh publish` on Linux as github-actions[bot].
  It checks the binaries against `SHA256SUMS` and attests build provenance for
  both binaries. Then it commits the bump, tags, pushes, and creates the GitHub
  release with both binaries and `SHA256SUMS`.

Both subcommands refuse to run unless `GITHUB_ACTIONS` is `true`.

The split keeps dependency code away from the write token. Only `publish` has
`contents: write`, `id-token: write`, and `attestations: write`. It runs no
bun, no setup action, and no latte binary, so no package code runs while it
holds those permissions. Keep it that way. `build` runs every dependency, with
`contents: read` and no persisted git credentials.

`publish` takes only the binaries and `SHA256SUMS` from `build`. It derives
the version from its own checkout and the bump input, and it writes
`package.json` itself. A tampered `package.json` from `build` cannot reach the
commit. The checksum check proves that the artifact arrived intact and that
`SHA256SUMS` describes the published binaries. It does not protect against a
compromised `build` job, which writes both files. The provenance attestation
records which workflow run built them.

The workflow pushes the bump commit with `GITHUB_TOKEN`. GitHub does not start
workflows for pushes made with that token, so the bump commit gets no CI run.

Every CI install runs `sfw bun install --frozen-lockfile` through Socket
Firewall, in `.github/actions/setup/action.yml`. Socket's free firewall
documents npm, yarn, and pnpm, not bun. It works with bun 1.4.4, measured on a
macOS 15 runner. `sfw` starts a local proxy and sets `HTTPS_PROXY` and
`NODE_EXTRA_CA_CERTS` for the command it wraps. Bun honors `HTTPS_PROXY`. With
it pointed at a closed port, `bun install` fails with `ConnectionRefused`, so an
unreachable firewall fails the install instead of bypassing it. Under `sfw`,
`bun install --verbose` with an empty cache downloads every tarball over HTTPS.

The setup action downloads `sfw-free-macos-arm64` from `SocketDev/sfw-free` at
the version in `SFW_VERSION`. It checks the file against
`SFW_MACOS_ARM64_SHA256` and fails the step on a mismatch. Do not use
`SocketDev/action`. It installs the latest `sfw` without a checksum. Dependabot
does not update the pin. To bump `sfw`, read the new asset's digest:

```sh
gh api repos/SocketDev/sfw-free/releases/tags/<tag> --jq '.assets[] | select(.name == "sfw-free-macos-arm64") | .digest'
```

Set `SFW_VERSION` to the tag. Set `SFW_MACOS_ARM64_SHA256` to the digest
without its `sha256:` prefix.

CI does not set `SFW_JSON_REPORT_PATH`, so `sfw` writes no report. A report
lists only blocked packages and parse failures, so a clean report would not
prove that traffic went through `sfw`. Check the environment `sfw env` adds and
run the closed-port control instead.

Pin every action by commit SHA with a `# vX.Y.Z` comment. Dependabot proposes
new pins weekly.

Preserve the `latte-darwin-arm64`, `latte-darwin-x64`, and `SHA256SUMS` asset
names. The installer selects those names directly. The `build` job verifies
both signatures and runs both binaries. Running x64 binaries on Apple Silicon
requires Rosetta. The `build` job runs `arch -x86_64 /usr/bin/true` and installs
Rosetta when it fails. `release.sh build` updates `package.json` before it tests
the binaries, so Rosetta must be ready before the script starts.

The installer checks a downloaded binary against the release's `SHA256SUMS`
before it runs the binary. Releases up to v0.4.1 have no `SHA256SUMS`. For
v0.4.1 only, `install.sh` uses two embedded hashes instead. Delete that
fallback after the next release. Any other release without `SHA256SUMS` fails
the install and leaves the existing install unchanged.

The installer must also verify that a downloaded binary starts and reports the
expected version before replacing an existing install. A release tag is not a
substitute for a successful executable version check.

`release.sh build` scans each binary for private data before it writes
`SHA256SUMS`. The scan reads the whole file with `grep -a`, because macOS
`strings` can skip Mach-O sections. It aborts the release on a `/Users/<name>`
path, the value of `git config user.email`, a GitHub, Anthropic, or AWS
credential, or a private-key header. The `build` job sets no git identity, so
the scan includes an email only if the runner image configures one. `publish`
checks the binaries against `SHA256SUMS`, so the published bytes are the
scanned bytes. Bun embeds latte's strings as UTF-8, so the scan has no UTF-16
patterns.

Bun's runtime holds strings that look like secrets but carry no data, such as
TLS labels like `CLIENT_TRAFFIC_SECRET_0` and CSS names that start with `sk-`.
Keep scan patterns specific enough to skip them.

## React production build

Build latte only through `scripts/build.sh <outfile> [bun-target]`.
`bun run build`, `scripts/install.sh compile`, and `scripts/release.sh` all
call it. The script passes `--define 'process.env.NODE_ENV="production"'`,
refuses a binary that contains `react-reconciler.development` or lacks
`react-reconciler.production`, and then signs the binary. It builds in a
temporary directory next to `<outfile>` and moves the binary to `<outfile>`
only after every check passes. Bun signs arm64 output itself, so a rejected
binary written straight to `<outfile>` would still run.

Without the define, latte bundles React's development build, which records 30
`performance.measure()` entries per dashboard render. Bun keeps every entry.
While a session runs, the dashboard polls and renders once a second, so memory
grows by about 1 GB a day. A v0.4.0 dashboard reached a 5.2 GB footprint after
5 days. With no session, the dashboard does not poll and memory stays flat.

To see which React build a published binary bundles, run
`grep -acF react-reconciler.development <binary>`. The v0.4.0 assets print
`1`, and the v0.4.1 assets print `0`. The marker shows the build, not the
memory behavior. Prove flat memory with `footprint` over a running session.

Builds are byte-for-byte deterministic, so compare SHA-256 hashes to prove
that a build change does not change the binary. The binary embeds
`package.json`, including its `scripts` block. An edit to `package.json`
changes the hash even when the code is the same. In that case, compare
`strings -n 8` output of the old and new binaries.

The `src/index.ts` shebang sets `NODE_ENV=production` for linked installs. It
overrides any `NODE_ENV` the caller sets, and the processes latte starts
inherit it. `bun run dev` ignores the shebang. Unless the caller sets
`NODE_ENV=production`, it runs React's development build, so a long
`bun run dev` dashboard session grows the same way.

`ps` RSS understates this growth because macOS compresses idle pages. The
5.2 GB dashboard showed 316 MB of RSS. Read the physical footprint with
`footprint <pid>` instead.
