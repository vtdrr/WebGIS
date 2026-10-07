/** PostgreSQL error code for unique_violation */
const UNIQUE_VIOLATION = '23505';

/** True when `err` is a PostgreSQL unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === UNIQUE_VIOLATION;
}
