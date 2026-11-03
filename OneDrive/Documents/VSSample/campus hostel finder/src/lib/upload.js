import { supabase } from "./supabase";

// Uploads into <bucket>/<userId>/... (the only folder the storage policy allows). Returns the public URL.
export async function uploadImage(bucket, uid, file) {
  if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) throw new Error("Image files only, max 2 MB each.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
