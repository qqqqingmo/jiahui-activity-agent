import { z } from "zod";

export interface ApiErrorBody {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
    public readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

export function validationMessage(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "请求"}：${issue.message}`).join("；");
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof z.ZodError) return new AppError("INVALID_REQUEST", validationMessage(error), 400);
  if (error instanceof SyntaxError) return new AppError("INVALID_REQUEST", "请求内容不是合法的 JSON", 400);
  return new AppError("INTERNAL_ERROR", "服务暂时不可用", 500, true, { cause: error });
}

export function apiErrorBody(error: unknown, requestId: string): ApiErrorBody {
  const appError = toAppError(error);
  return {
    code: appError.code,
    message: appError.message,
    retryable: appError.retryable,
    requestId
  };
}
