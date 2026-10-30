# latte

Friendly macOS sleep prevention for humans and AI agents.

Keep your Mac awake while an agent works, without learning `caffeinate` flags. Pick whether the screen stays on and how long, and latte picks the flags.

```
$ latte status
☕ Active — Mac stays awake, screen can sleep
   Running for: 1h 23m
   Remaining: 37m
```

## Install

### Quick install (precompiled binary, macOS only)

```sh
curl -fsSL https://raw.githubusercontent.com/Junnyyy/latte/main/install.sh | bash
```

Run the same command to update to the latest version. It will skip the download if you're already up to date.

### From source

Requires [Bun](https://bun.sh).

```sh
git clone https://github.com/Junnyyy/latte.git
cd latte
bun install
```

### For development (source-linked, changes take effect immediately)

```sh
bun run link
```

### For daily use (compiled binary, faster startup)

```sh
bun run install:global
```

Both methods install `latte` to `~/.local/bin/`. Make sure it's in your PATH:

```sh
# Add to ~/.zshrc or ~/.bashrc if not already present
export PATH="$HOME/.local/bin:$PATH"
```

## Uninstall

```sh
bun run uninstall
```

Or manually: `rm ~/.local/bin/latte`

## Usage

### Pick the command for your situation

| Your situation | Command | What stays awake |
|----------------|---------|------------------|
| You hand work to an agent and walk away for lunch, a meeting, or the night | `latte on` | The Mac. The screen sleeps and locks as usual. |
| You watch the agent's output, or you present from this Mac | `latte on --screen` | The Mac and the screen. |
| You start a run that should stop keeping the Mac awake by itself | `latte 2h` | The Mac, for 2 hours. Add `--screen` to keep the screen on too. |
| You are an agent or a script that manages its own session | `latte on`, then `latte off` | Same as `latte on`. Output is plain text and `off` is idempotent. |
| You need specific `caffeinate` assertions | `latte on --flags dims` | Exactly the flags you pass. See [Advanced: exact flags](#advanced-exact-flags). |

Keep the lid open. macOS can still sleep the Mac when you close the lid, whatever latte holds.

### Turn on

```sh
latte on            # Mac stays awake, screen can sleep
latte on --screen   # Mac and screen stay awake
```

`latte on` starts `caffeinate` in the background and returns immediately. It keeps running after you close the terminal. `-d` is a short form of `--screen`.

### Turn on for a set time

```sh
latte 30m
latte 2h --screen
latte 90s
```

The duration accepts `s`, `m`, and `h`. When the time runs out, `caffeinate` exits by itself and the Mac can sleep again.

### Turn off

```sh
latte off
```

`latte off` stops every running `caffeinate`. If nothing is running, it exits with code `0`.

### Check status

```sh
latte status
```

`latte status` shows what latte keeps awake, how long it has run, and the time left in a timed session.

### Interactive mode

```sh
latte
```

In a terminal, `latte` with no arguments opens a live dashboard. It updates every second.

- **o** turns latte on.
- **x** turns latte off.
- **t** starts a timed session. The dashboard asks for a duration.
- **s** toggles whether the screen stays on. The choice applies to the next **o** or **t**. It does not change a running session. Until you restart, the dashboard shows a `Next start:` line.
- **f** opens the advanced flag picker. See [Advanced: exact flags](#advanced-exact-flags).
- **q** quits the dashboard. `caffeinate` keeps running.

When the output is not a terminal, `latte` prints `latte status` instead.

### Replacing a running session

If `caffeinate` is already running, `latte on` and `latte <duration>` show the running session and ask before they replace it:

```
⚠ Caffeinate is already running (1h 23m, indefinite)
Kill existing and start 30m timer? (y/n)
```

The dashboard shows the same question as a dialog.

## Advanced: exact flags

The two presets cover most sessions. Use exact flags only when you need a specific `caffeinate` assertion.

`--flags` replaces the preset with exactly the letters you pass. It also ignores `LATTE_FLAGS`.

```sh
latte on --flags dims
latte 2h --flags im
```

| Letter | `caffeinate` assertion |
|--------|------------------------|
| `d` | Prevents the display from sleeping. This also prevents idle system sleep. |
| `i` | Prevents idle system sleep. The display can still sleep. |
| `m` | Prevents disk idle sleep. |
| `s` | Prevents system sleep. It applies only on AC power. |
| `u` | Declares user activity. Without a timeout, `caffeinate` drops it after 5 seconds. |

You can't combine `--flags` with `--screen`. Add `d` to `--flags` instead.

To add flags to every preset session, set `LATTE_FLAGS` in your shell profile. For example, this line makes every session keep the screen on:

```sh
echo 'export LATTE_FLAGS="-d"' >> ~/.zshrc
```

In the dashboard, press **f** to toggle single letters, **r** to reset to the preset, **Enter** to keep the changes, and **Esc** to discard them.

## How it works

latte has no config files and no PID files. Every command inspects the running processes:

1. `pgrep -x caffeinate` finds a running `caffeinate`.
2. `ps` reads its flags, start time, and timeout.
3. `pkill -x caffeinate` stops it.

The presets map to these flags:

| Preset | Flags | Effect |
|--------|-------|--------|
| `latte on` | `-is` | Prevents idle sleep. On AC power, also prevents system sleep. The display sleeps on its normal timer. |
| `latte on --screen` | `-dis` | Adds `-d`, which keeps the display on. |

Earlier versions used `-imsu`. Without a timeout, `caffeinate` drops the `-u` and `-m` assertions after about 5 seconds. With a timeout, it holds them for the whole session. So `latte on` and `latte 30m` behaved differently. The presets leave out both flags.

## For AI agents

Every command is non-interactive when its output is not a terminal:

```sh
latte on            # before a long task
latte 2h            # or with a time limit
latte on --screen   # keep the screen on, for example to watch progress
latte status        # check what is running
latte off           # clean up
```

- When the output is not a terminal, latte prints plain text and opens no dashboard.
- `latte off` is idempotent. Run it unconditionally in scripts.
- An unknown option fails with exit code `1`. latte does not ignore it.
- Exit codes: `0` for success, `1` for an error.

## Architecture

Built with [Bun](https://bun.sh), [Effect TS](https://effect.website), [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli), and [Ink](https://github.com/vadimdemedes/ink).

```
ProcessService              Bun.spawn wrapper
    |
    +-- CaffeinateService   detect, start, kill caffeinate
```

Services use Effect's dependency injection (`Effect.Service` + `Layer`). Errors are type-safe tagged unions (`Data.TaggedError`). The CLI is declarative via `@effect/cli` with auto-generated help and shell completions (`latte --completions zsh`).

## Development

```sh
bun install
bun run link                    # install as source symlink
bun run dev -- status           # run directly without installing
bun test                        # run tests
bun run build                   # compile standalone binary
bun run typecheck               # type check
```

### Releasing

Requires the [GitHub CLI](https://cli.github.com) (`gh`) and an Apple Silicon Mac with Rosetta to test both architectures.

```sh
bun run release patch           # 0.1.0 -> 0.1.1
bun run release minor           # 0.1.0 -> 0.2.0
bun run release major           # 0.1.0 -> 1.0.0
```

This bumps `package.json` version and cross-compiles darwin arm64 and x64 binaries. It ad-hoc signs both executables, verifies their signatures, and checks their versions before it commits, tags, pushes, and creates a GitHub Release.

To build and check locally without publishing, run `bun run build` and `./latte --version`. Ad-hoc signing prevents invalid-signature startup failures. It does not notarize the executable.

## License

MIT
