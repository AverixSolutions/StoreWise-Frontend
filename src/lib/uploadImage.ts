// frontend/src/lib/uploadImage.ts
const API_BASE =
  process.env.NEXT_PUBLIC_KYNFLOW_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

export type UploadedImage = {
  publicUrl: string;
  key: string;
};

/**
 * 1. Ask backend for a presigned PUT URL
 * 2. PUT the file directly to R2
 * 3. Return the public URL to store in the product record
 */
export async function uploadProductImage(
  file: File,
  licenseId: string,
  token: string,
): Promise<UploadedImage> {
  // Step 1 — get presigned URL from our backend
  const presignRes = await fetch(
    `${API_BASE}/api/upload/product-image/presign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        licenseId,
        contentType: file.type,
      }),
    },
  );

  if (!presignRes.ok) {
    throw new Error("Failed to get upload URL");
  }

  const { uploadUrl, publicUrl, key } = await presignRes.json();

  // Step 2 — upload directly to R2 (no bandwidth through our server)
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("Image upload to storage failed");
  }

  return { publicUrl, key };
}

/**
 * Convert a File to base64 for local/offline preview only.
 * Do NOT store this in the product record.
 */
export function fileToPreviewUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
