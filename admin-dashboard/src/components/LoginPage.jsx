import { useState } from "react";
import { api, errorText } from "../api.js";

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🐦</span>
          <div>
            <h1>Flying Bird</h1>
            <p className="muted">لوحة تحكم الأدمن</p>
          </div>
        </div>

        <label className="field">
          <span>باسورد الأدمن</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            dir="ltr"
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-block" disabled={busy || !password}>
          {busy ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
