export function getValidAvatarUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";

  const url = value.trim();
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname ? url : "";
  } catch {
    return "";
  }
}

export function getProfileInitial(name, fallback = "U") {
  return (typeof name === "string" && name.trim() ? name.trim() : fallback).charAt(0).toUpperCase() || "U";
}

export function isProfileAvatarReady(url, loadedUrl, failedUrl) {
  return Boolean(url) && url === loadedUrl && url !== failedUrl;
}
