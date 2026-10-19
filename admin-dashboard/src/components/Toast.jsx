import { useEffect } from "react";

export default function Toast({ text, kind, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`toast toast-${kind}`} role="status">
      {text}
    </div>
  );
}
