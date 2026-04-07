const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RED = "\x1b[31m"
const CYAN = "\x1b[36m"

export const bold = (s: string) => `${BOLD}${s}${RESET}`
export const dim = (s: string) => `${DIM}${s}${RESET}`
export const green = (s: string) => `${GREEN}${s}${RESET}`
export const yellow = (s: string) => `${YELLOW}${s}${RESET}`
export const red = (s: string) => `${RED}${s}${RESET}`
export const cyan = (s: string) => `${CYAN}${s}${RESET}`
