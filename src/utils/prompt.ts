/**
 * Prompt the user for a yes/no confirmation in raw mode.
 * Returns true if user presses 'y', false otherwise.
 *
 * In non-TTY contexts (piped/scripted), auto-confirms to avoid hanging.
 */
export function promptYesNo(question: string): Promise<boolean> {
  // Non-interactive: auto-confirm so scripts don't hang
  if (!process.stdin.isTTY) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    process.stdout.write(`${question} (y/n) `)
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    const onData = (data: string) => {
      process.stdin.removeListener("data", onData)
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdout.write(`${data}\n`)
      resolve(data.toLowerCase() === "y")
    }

    process.stdin.on("data", onData)
  })
}
