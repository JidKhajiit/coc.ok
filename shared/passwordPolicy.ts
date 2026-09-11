/** Password policy shared by client UI and server validation. */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** Special characters allowed / required in passwords. */
export const PASSWORD_SPECIALS = '!@#$%^&*()_+-=[]{}|;:,.<>?'

const LETTER_RE = /[a-zA-Z]/
const DIGIT_RE = /\d/

export type PasswordPolicyIssue =
  | 'too_short'
  | 'too_long'
  | 'no_letter'
  | 'no_digit'
  | 'no_special'

function hasSpecial(password: string): boolean {
  for (const ch of password) {
    if (PASSWORD_SPECIALS.includes(ch)) return true
  }
  return false
}

export function getPasswordPolicyIssues(password: string): PasswordPolicyIssue[] {
  const issues: PasswordPolicyIssue[] = []
  if (password.length < PASSWORD_MIN_LENGTH) issues.push('too_short')
  if (password.length > PASSWORD_MAX_LENGTH) issues.push('too_long')
  if (!LETTER_RE.test(password)) issues.push('no_letter')
  if (!DIGIT_RE.test(password)) issues.push('no_digit')
  if (!hasSpecial(password)) issues.push('no_special')
  return issues
}

export function isPasswordStrong(password: string): boolean {
  return getPasswordPolicyIssues(password).length === 0
}

const GENERATE_LENGTH = 16
const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'

function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]! % max
  }
  return Math.floor(Math.random() * max)
}

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)]!
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars
}

/** Generates a password with letters, digits, and special characters. */
export function generatePassword(length = GENERATE_LENGTH): string {
  const size = Math.min(PASSWORD_MAX_LENGTH, Math.max(PASSWORD_MIN_LENGTH, length))
  const all = LETTERS + DIGITS + PASSWORD_SPECIALS
  const chars: string[] = [pick(LETTERS), pick(DIGITS), pick(PASSWORD_SPECIALS)]
  while (chars.length < size) chars.push(pick(all))
  return shuffle(chars).join('')
}
