---
name: verify
description: Drive the latte CLI and Ink TUI the way a user does and capture proof. Builds the signed macOS binary, runs commands and keystroke scripts in a pseudo-terminal, and records the caffeinate processes each step leaves behind. Use to prove a latte change works, reproduce a latte bug, or check a release candidate.
---

# Verify latte

latte wraps macOS `caffeinate`. Its only state is the system-wide `caffeinate` process: it finds one with `pgrep -x caffeinate` and stops all of them with `pkill -x caffeinate`. A run cannot be isolated from other `caffeinate` processes on the machine. The helper refuses every mutating drive while a `caffeinate` it did not start is alive. Do not work around that refusal. Ask the user.

Every command goes through `.claude/skills/verify/latte-verify`. Run it from anywhere in the checkout. Shell state does not persist between tool calls, so prefix each call with the literal run dir.

## Launch

```bash
.claude/skills/verify/latte-verify new
```

It prints a run dir such as `$TMPDIR/latte-verify/run-20261028-190812-86583` and records the git revision. Then build:

```bash
LATTE_VERIFY_RUN=<run dir> .claude/skills/verify/latte-verify build
```

`build` runs `bun install --frozen-lockfile` and `bun run build`, then copies the signed binary to `<run dir>/latte` and records its SHA-256. Every drive runs that copy. Rebuild after each source change. latte is a short-lived CLI, so there is no server to wait for. The binary is ready when `doctor` passes.

## Doctor

```bash
LATTE_VERIFY_RUN=<run dir> .claude/skills/verify/latte-verify doctor
```

Read-only. Exit 0 means the instance is worth driving. It checks that the binary matches the recorded build, `codesign --verify --strict` passes, and `--version` equals `package.json`. It also lists every live `caffeinate` as ours or foreign. Exit 2 means a foreign `caffeinate` exists and mutating drives are blocked. Exit 1 means the binary is broken. An invalid signature makes macOS SIGKILL the binary at launch, which shows as exit 137 or `zsh: killed`. See `AGENTS.md`.

## Drive

Two drivers. Both refuse `on`, `off`, durations, and any PTY drive while a foreign `caffeinate` is alive (exit 3).

**`cli`** runs the binary with stdin from `/dev/null`. stdin is not a TTY, so the "already running" prompt auto-confirms, and bare `latte` prints status instead of opening the TUI.

```bash
LATTE_VERIFY_RUN=<run dir> .claude/skills/verify/latte-verify cli <label> -- <latte args>
LATTE_VERIFY_RUN=<run dir> LATTE_FLAGS=-d .claude/skills/verify/latte-verify cli env-flags -- on
```

**`pty`** runs the binary in a 100x40 pseudo-terminal under a job-control shell, the way a terminal tab runs it. With no latte args it opens the TUI. Steps run in order and any failed `wait:` exits 1.

```bash
LATTE_VERIFY_RUN=<run dir> .claude/skills/verify/latte-verify pty <label> <step>... [-- <latte args>]
```

- `wait:<text>` waits up to 10s for visible text, matching across color codes, then pauses 0.3s so Ink can take the keyboard.
- `send:<text>` types one character at a time. Use it for letter keys such as `send:q`.
- `key:enter`, `key:esc`, `key:ctrl-c`.
- `sleep:<seconds>`.

End every TUI drive with `send:q`. A drive that leaves latte running fails.

The feature map at [`features/README.md`](features/README.md) has the recipe for each user path. Read the matching feature file before driving.

## Evidence

Each drive writes a numbered step dir inside the run dir, such as `<run dir>/03-pty-tui-timed/`.

- `cmd.txt` holds the exact `latte` invocation and `LATTE_FLAGS`.
- `stdout.txt`, `stderr.txt`, and `exit.txt` come from `cli` drives. stdout keeps latte's color codes, so search the summary the helper prints, or strip the codes first.
- `steps.txt`, `drive.exp`, `transcript.raw`, and `transcript.txt` come from `pty` drives. The `.txt` transcript has color codes removed and contains every frame Ink drew, in order.
- `caffeinate-before.txt` and `caffeinate-after.txt` list each live `caffeinate` with PID, start time, and arguments. This is the side effect. A proof cites it, not only the printed message.

Proof standards:

- Drive the built binary through `cli` or `pty`. `bun run dev` and `bun test` do not prove that macOS accepts the signed executable.
- Prove a state change from both sides. Cite the message latte printed, the `caffeinate-after.txt` arguments, and a following `cli status` or TUI frame that reads the new state.
- For a TUI change, cite the transcript frame before the keystroke and the frame after it.
- Report the run dir and step dirs you cite.

## Cleanup

```bash
LATTE_VERIFY_RUN=<run dir> .claude/skills/verify/latte-verify cleanup
```

It kills only the `caffeinate` PIDs this run recorded in `<run dir>/ours.pids`, and only if each PID is still a `caffeinate`. It never kills by name and never deletes the run dir. Evidence stays in `<run dir>`. The repo-root `latte` binary from `bun run build` is gitignored and stays too. Run cleanup after every run, including failed ones.
