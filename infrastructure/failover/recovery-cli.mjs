import { readFile, stat } from "node:fs/promises";
import { recoverPackage, RECEIPT_LIMIT } from "./recovery-receipt.mjs";
const [command, file, expectedDigest, output] = process.argv.slice(2);
if (command !== "recover" || !file || !expectedDigest || !output)
  throw new Error(
    "Usage: recovery-cli.mjs recover RECEIPT EXTERNAL_SHA256 FRESH_SCRATCH_DIRECTORY",
  );
if ((await stat(file)).size > RECEIPT_LIMIT)
  throw new Error("Receipt exceeds small-artifact limit");
const result = await recoverPackage({
  receiptBytes: await readFile(file),
  expectedDigest,
  output,
});
console.log(JSON.stringify(result)); // release identity/counts only; no queries/provider errors
