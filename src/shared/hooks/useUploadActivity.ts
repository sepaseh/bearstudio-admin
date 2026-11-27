import { useCallback, useRef, useState } from "react";

export const useUploadActivity = () => {
  const pending = useRef(new Set<string>());
  const [uploading, setUploading] = useState(false);

  const trackUpload = useCallback((field: string, active: boolean) => {
    if (active) pending.current.add(field);
    else pending.current.delete(field);
    setUploading(pending.current.size > 0);
  }, []);

  return { uploading, trackUpload, hasUploads: () => pending.current.size > 0 };
};
