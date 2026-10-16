import bcrypt from "bcryptjs";

/**
 * Temporary passwords for teacher CSV imports. The import flow must produce a
 * hash that the *same bcryptjs checker used by /api/login* can verify, before
 * it creates the account. We standardize on $2a$ for compatibility with the
 * known-working password-reset format. bcryptjs's $2a$ and $2b$ encodings use
 * the same algorithm for these ASCII student-number passwords.
 *
 * Never log the student number or password hash.
 */
export function createVerifiedStudentTemporaryHash(studentNumber: string): string {
  if (!/^[0-9]{2,40}$/.test(studentNumber)) {
    throw new Error("Student number must contain 2–40 digits.");
  }
  const bcryptHash = bcrypt.hashSync(studentNumber, 10);
  const passwordHash = bcryptHash.startsWith("$2b$")
    ? "$2a$" + bcryptHash.slice(4)
    : bcryptHash;
  if (!bcrypt.compareSync(studentNumber, passwordHash)) {
    throw new Error("The imported student's temporary password failed verification.");
  }
  return passwordHash;
}

export function verifyStudentTemporaryHash(studentNumber: string, storedHash: string | undefined | null): boolean {
  return !!storedHash && bcrypt.compareSync(studentNumber, storedHash);
}
