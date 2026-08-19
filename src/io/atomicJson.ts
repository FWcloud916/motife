import { mkdir, open, rename } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** Same-directory temp + fsync + rename, so readers see old or new JSON,
 * never a partially-written checkpoint. */
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temp = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  const handle = await open(temp, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, filePath);
}
