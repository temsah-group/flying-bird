import { useEffect, useRef, useState } from "react";

/**
 * One modal for all admin actions.
 *  input: undefined (just confirm) | { label, type, minLength, placeholder, required }
 */
export default function Modal({ title, message, confirmText, danger, input, onConfirm, onClose }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current && firstRef.current.focus();
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const invalid =
    input && ((input.required && !value.trim()) || (input.minLength && value.length < input.minLength));

  async function submit(e) {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(value);
      onClose();
    } catch (err) {
      setError(err.message || "حصل خطأ");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onSubmit={submit}>
        <h3 id="modal-title">{title}</h3>
        {message && <p className="muted">{message}</p>}

        {input && (
          <label className="field">
            <span>{input.label}</span>
            <input
              ref={firstRef}
              type={input.type || "text"}
              value={value}
              placeholder={input.placeholder}
              onChange={(e) => setValue(e.target.value)}
              dir="auto"
            />
            {input.minLength && (
              <small className="muted">{input.minLength} حروف على الأقل</small>
            )}
          </label>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button
            ref={input ? null : firstRef}
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            disabled={busy || invalid}
          >
            {busy ? "..." : confirmText}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
