import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function compactResponsePreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 140)
}

export async function readJsonResponse<T>(
  response: Response,
  context: string,
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.toLowerCase().includes("application/json")) {
    return (await response.json()) as T
  }

  const text = await response.text()
  const preview = compactResponsePreview(text)
  const routeHint =
    response.status === 404
      ? " The local dev server likely does not have this API route loaded."
      : ""

  throw new Error(
    `${context} returned ${response.status} ${response.statusText || "response"} instead of JSON.${routeHint}${
      preview ? ` Response started with: ${preview}` : ""
    }`,
  )
}
