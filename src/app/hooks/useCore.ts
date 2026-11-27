import { useContext } from "react";

import { CoreContext } from "@/app/contexts";

export const useOptionalCore = () => useContext(CoreContext);

export const useCore = () => {
  const context = useOptionalCore();
  if (!context) throw new Error("useCore must be used within a CoreProvider");

  return context;
};
