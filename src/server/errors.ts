export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new ServiceError(status, message);
}
export function safeError(error: unknown) {
  if (error instanceof ServiceError)
    return { status: error.status, message: error.message };
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23514"
  )
    return {
      status: 409,
      message:
        "The record is no longer writable or valid. Refresh to retrieve its current state.",
    };
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  )
    return {
      status: 409,
      message: "This record already exists. Refresh and try again.",
    };
  console.error("Server operation failed.", {
    code:
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "INTERNAL",
  });
  return {
    status: 500,
    message: "The operation could not be completed. Please try again.",
  };
}
