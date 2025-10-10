/**
 * Generates a random ID string
 * @returns A random ID string
 */
export function randomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}