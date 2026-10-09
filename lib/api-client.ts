// src/lib/api-client.ts — frontend fetch wrapper
"use client";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && String((data as Record<string, unknown>).error)) ||
      res.statusText ||
      "Request gagal";
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

// Upload files via multipart (no JSON content-type)
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData
): Promise<T> {
  const res = await fetch(path, { method: "POST", body: formData });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && String((data as Record<string, unknown>).error)) ||
      res.statusText ||
      "Upload gagal";
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}
