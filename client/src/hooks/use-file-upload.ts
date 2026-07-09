import { useState } from "react";
import { apiUrl } from "@/lib/api-url";

export type UploadState = "idle" | "uploading" | "done" | "error";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function useFileUpload() {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [objectPath, setObjectPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<string | null> => {
    setState("uploading");
    setProgress(10);
    setError(null);
    setObjectPath(null);

    try {
      const token = localStorage.getItem("auth_token");
      setProgress(40);
      const fileData = await fileToBase64(file);
      setProgress(70);

      const res = await fetch(apiUrl("/api/uploads"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileData,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }

      const { path } = await res.json();
      setProgress(100);
      setState("done");
      setObjectPath(path);
      return path;
    } catch (err: any) {
      setState("error");
      setError(err.message ?? "Upload failed");
      return null;
    }
  };

  const reset = () => {
    setState("idle");
    setProgress(0);
    setObjectPath(null);
    setError(null);
  };

  return { upload, state, progress, objectPath, error, reset };
}
