import { useEffect, useState } from "react";
import { getProfileInitial, getValidAvatarUrl, isProfileAvatarReady } from "../utils/profileAvatar.js";

function ProfileAvatar({ src, name, fallbackName, imageClassName, fallbackClassName, alt = "" }) {
  const imageUrl = getValidAvatarUrl(src);
  const [loadedUrl, setLoadedUrl] = useState("");
  const [failedUrl, setFailedUrl] = useState("");

  useEffect(() => {
    setLoadedUrl("");
    setFailedUrl("");
  }, [imageUrl]);

  const fallback = <span className={fallbackClassName} aria-hidden="true">{getProfileInitial(name, fallbackName || "U")}</span>;
  if (!imageUrl) return fallback;

  if (isProfileAvatarReady(imageUrl, loadedUrl, failedUrl)) {
    return <img className={imageClassName} src={imageUrl} alt={alt} onError={() => setFailedUrl(imageUrl)} />;
  }

  if (failedUrl === imageUrl) return fallback;

  return <>
    {fallback}
    <img src={imageUrl} alt="" aria-hidden="true" style={{ display: "none" }} onLoad={() => setLoadedUrl(imageUrl)} onError={() => setFailedUrl(imageUrl)} />
  </>;
}

export default ProfileAvatar;
