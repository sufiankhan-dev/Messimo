let operationChain: Promise<unknown> = Promise.resolve();

/**
 * Serialize file-changing batches inside this server process. Two browser tabs
 * cannot interleave moves, and an undo cannot run while an apply is halfway
 * through its own revalidation. Reads and history lookups do not take this lock.
 */
export function withFileOperationLock<T>(task: () => Promise<T>): Promise<T> {
  const next = operationChain.then(task, task);
  operationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
