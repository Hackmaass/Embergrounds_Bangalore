import { randomUUID } from "node:crypto";

/** Short, readable id: `<prefix>-<8 hex chars>`, e.g. `dec-a1b2c3d4`. */
export function makeId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
