# latte

Friendly macOS sleep prevention for humans and AI agents.

Keep your machine awake for long builds, agent runs, and lunch breaks without remembering `caffeinate` flags. `latte` wraps it with a clean CLI and a live TUI dashboard.

```
$ latte status
☕ Active — preventing sleep
   Modes: idle, disk, system (AC), wake display
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

### Turn on (indefinite)

```sh
latte on
```

Spawns `caffeinate -imsu` in the background and returns immediately. Prevents idle sleep, disk sleep, and system sleep while letting the display sleep naturally. Pass [custom flags](#custom-flags) to change which sleep modes are prevented.

### Turn off

```sh
latte off
```

Kills any running caffeinate process. Safe to run when nothing is running — exits cleanly.

### Timed session

```sh
latte 30m     # 30 minutes
latte 2h      # 2 hours
latte 90s     # 90 seconds
```

Caffeinate self-terminates when the timer expires. No cleanup needed.

### Custom flags

By default, latte uses `-imsu`. You can add or remove flags per session:

```sh
latte on --display          # add display sleep prevention (-d)
latte on -d                 # same, short form
latte on --no-system        # remove system sleep prevention
latte 30m -d --no-system    # combine: add display, drop system
```

Available flags:

| Short | Long | Removes |
|-------|------|---------|
| `-d` | `--display` | `--no-display` |
| `-i` | `--idle` | `--no-idle` |
| `-m` | `--disk` | `--no-disk` |
| `-s` | `--system` | `--no-system` |
| `-u` | `--wake` | `--no-wake` |

To make flags permanent without a config file, set `LATTE_FLAGS` in your shell profile:

```sh
# Always keep the display on
echo 'export LATTE_FLAGS="-d"' >> ~/.zshrc
```

`LATTE_FLAGS` is additive — it merges with the defaults. CLI flags override everything, with removes applied last.

### Check status

```sh
latte status
```

Shows whether caffeinate is running, which sleep modes are prevented, how long it's been active, and time remaining for timed sessions.

### Interactive mode

```sh
latte
```

When run with no arguments in a terminal, launches a live TUI dashboard:

- **o** to start indefinite caffeinate
- **x** to stop caffeinate
- **t** to start a timed session (prompts for duration)
- **q** to quit (caffeinate keeps running)

The dashboard updates every second — you can watch a countdown tick in real time. When piped or in a non-TTY context, falls back to `latte status`.

### Collision handling

If caffeinate is already running, `latte on` and `latte <duration>` will show what's active and ask before replacing it:

```
⚠ Caffeinate is already running (1h 23m, indefinite)
Kill existing and start 30m timer? (y/n)
```

In the TUI, this appears as a confirm dialog instead of a y/n prompt.

## How it works

`latte` is a stateless wrapper around macOS `caffeinate`. It has no config files and no PID files — every command inspects running processes directly:

1. `pgrep -x caffeinate` to detect if caffeinate is running
2. `ps` to extract flags, start time, and timer duration
3. `pkill -x caffeinate` to stop it

The default flags are `-imsu`:

| Flag | Prevents |
|------|----------|
| `-i` | Idle sleep |
| `-m` | Disk sleep |
| `-s` | System sleep (on AC power) |
| `-u` | Declares user activity |

By default, no `-d` (display) — the display is free to sleep. To change which flags are used, see [Custom flags](#custom-flags).

## For AI agents

Every command is non-interactive when piped:

```sh
# Start before a long task
latte on

# Start with a timeout
latte 2h

# Keep the display on (e.g. for visual monitoring)
latte on -d

# Check if running
latte status

# Clean up
latte off
```

- Non-TTY mode uses plain text output (no TUI)
- `latte off` is idempotent — safe to run unconditionally in scripts
- Exit codes: `0` success, `1` error

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

Requires the [GitHub CLI](https://cli.github.com) (`gh`).

```sh
bun run release patch           # 0.1.0 -> 0.1.1
bun run release minor           # 0.1.0 -> 0.2.0
bun run release major           # 0.1.0 -> 1.0.0
```

This bumps `package.json` version, cross-compiles darwin arm64 and x64 binaries, commits, tags, pushes, and creates a GitHub Release with both binaries attached.

## License

MIT
