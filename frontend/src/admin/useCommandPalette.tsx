// useCommandPalette.tsx
import { useEffect, useState } from "react";
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if ((isMac && e.metaKey && e.key.toLowerCase()==="k") ||
          (!isMac && e.ctrlKey && e.key.toLowerCase()==="k")) {
        e.preventDefault(); setOpen(true);
      }
      if(e.key==="Escape") setOpen(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
