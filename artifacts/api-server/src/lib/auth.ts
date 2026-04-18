import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { SafeUser } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET || "caprina-secret-key-change-in-prod";
const JWT_EXPIRES = "7d";

export function signToken(user: SafeUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, displayName: user.displayName },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

export function verifyToken(token: string): SafeUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SafeUser;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
