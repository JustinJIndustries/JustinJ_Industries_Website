// Fully injected inactive composition. Importing it does nothing, and its public
// entry point refuses all writes unless an explicitly approved caller opts in.
// Provider transports/owner archive readers have no default implementations.
import { verifyPackage } from "./prepare-release.mjs";
import { createRecoveryRecorder } from "./recovery-store.mjs";
import {
  bindBootstrapAdapters,
  bindReleaseAdapters,
  bindRollbackAdapters,
} from "./bind-release-adapters.mjs";
import {
  coordinateBootstrap,
  coordinateRelease,
  coordinateRollback,
} from "./coordinate-release.mjs";

export async function runPublicationSession({
  mode,
  packageRoot,
  originalRoot,
  bindings,
  recovery,
  writesApproved = false,
}) {
  if (!writesApproved) throw new Error("Publication session is disabled");
  if (!["bootstrap", "release", "rollback"].includes(mode))
    throw new Error("Explicit publication mode required");
  const release = await verifyPackage(packageRoot);
  const receiptRecorder = createRecoveryRecorder({
    ...recovery,
    packageRoot,
    writesApproved,
  });
  if (mode === "rollback") {
    if (!originalRoot)
      throw new Error("Original package required for rollback");
    return coordinateRollback(
      originalRoot,
      bindRollbackAdapters({
        ...bindings,
        originalRoot,
        rollbackRoot: packageRoot,
        originalRelease: await verifyPackage(originalRoot),
        rollbackRelease: release,
        receiptRecorder,
        writesApproved,
      }),
    );
  }
  const adapters = (
    mode === "bootstrap" ? bindBootstrapAdapters : bindReleaseAdapters
  )({
    ...bindings,
    release,
    packageRoot,
    receiptRecorder,
    writesApproved,
  });
  return (mode === "bootstrap" ? coordinateBootstrap : coordinateRelease)(
    packageRoot,
    adapters,
  );
}
