export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export function successResponse<T = void>(data?: T): IpcResponse<T> {
  return { success: true, data };
}

export function errorResponse(error: unknown): IpcResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return { success: false, error: errorMessage };
}
