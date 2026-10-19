import { useEffect, useState } from "react";
import { api, errorText } from "../api.js";
import { formatDate, formatDateTime, formatNumber, timeAgo } from "../format.js";
import Modal from "./Modal.jsx";

const TABS = [
  { key: "all", label: "الكل" },
  { key: "online", label: "أونلاين" },
  { key: "banned", label: "محظورين" },
  { key: "alerts", label: "تنبيهات أمنية" },
];
const LIMIT = 20;

export default function UsersTable({ gameId, tick, onChanged, notify }) {
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  // Debounce search typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => setPage(1), [gameId, status]);

  useEffect(() => {
    let alive = true;
    api
      .users({ gameId: gameId === "all" ? "" : gameId, status, search, page, limit: LIMIT })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError("");
      })
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [gameId, status, search, page, tick]);

  // Wraps an action: run it, show a toast, refresh everything. Errors show inside the modal.
  const act = (fn, okText) => async (value) => {
    try {
      await fn(value);
    } catch (e) {
      throw new Error(errorText(e));
    }
    notify(okText);
    onChanged();
  };

  const open = {
    kick: (u) =>
      setModal({
        title: `طرد ${u.username}`,
        message: "اللاعب هيخرج من اللعبة دلوقتي ويرجع لشاشة اللوجين. يقدر يدخل تاني عادي.",
        confirmText: "اطرد",
        onConfirm: act(() => api.kick(u.id), `تم طرد ${u.username}`),
      }),
    ban: (u) =>
      setModal({
        title: `حظر ${u.username}`,
        message: "اللاعب هيخرج من اللعبة ومش هيقدر يدخل تاني لحد ما تفك الحظر.",
        confirmText: "احظر",
        danger: true,
        input: { label: "السبب (اختياري)", placeholder: "مثلاً: غش" },
        onConfirm: act((reason) => api.ban(u.id, reason), `تم حظر ${u.username}`),
      }),
    unban: (u) =>
      setModal({
        title: `فك حظر ${u.username}`,
        message: "اللاعب هيقدر يدخل اللعبة تاني.",
        confirmText: "فك الحظر",
        onConfirm: act(() => api.unban(u.id), `تم فك حظر ${u.username}`),
      }),
    password: (u) =>
      setModal({
        title: `باسورد جديد لـ ${u.username}`,
        message: "اللاعب هيخرج من اللعبة ويدخل بالباسورد الجديد.",
        confirmText: "غيّر الباسورد",
        input: { label: "الباسورد الجديد", type: "text", minLength: 6, required: true },
        onConfirm: act((pw) => api.setPassword(u.id, pw), `تم تغيير باسورد ${u.username}`),
      }),
    clearAlert: (u) =>
      setModal({
        title: `تنبيه أمني: ${u.username}`,
        message: `${ALERT_TEXT[u.securityEvent.type] || u.securityEvent.type} — ${formatDateTime(u.securityEvent.at)} من IP ${u.securityEvent.ip || "؟"}. السيرفر قفل الجلسة تلقائياً. لو شاكك إن الباسورد اتسرق، غيّره من زرار "باسورد".`,
        confirmText: "تمت المراجعة",
        onConfirm: act(() => api.clearAlert(u.id), `تم إخفاء التنبيه`),
      }),
    remove: (u) =>
      setModal({
        title: `حذف ${u.username}`,
        message: "الحساب هيتمسح نهائي ومش هينفع ترجّعه.",
        confirmText: "احذف نهائي",
        danger: true,
        onConfirm: act(() => api.remove(u.id), `تم حذف ${u.username}`),
      }),
  };

  const users = data ? data.users : [];

  return (
    <section className="card">
      <div className="card-head wrap">
        <h2 className="card-title">
          اليوزرات {data && <span className="muted num">({formatNumber(data.total)})</span>}
        </h2>
        <div className="filters">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={status === t.key}
                className={`tab ${status === t.key ? "tab-active" : ""}`}
                onClick={() => setStatus(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="search"
            type="search"
            placeholder="ابحث باليوزر..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="banner-error" role="alert">{error}</p>}

      <div className="table-scroll">
        <table className="users">
          <thead>
            <tr>
              <th>اليوزر</th>
              <th>اللعبة</th>
              <th>الحالة</th>
              <th>آخر نشاط</th>
              <th>آخر دخول</th>
              <th>اتسجل</th>
              <th className="actions-col">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {!data &&
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={7}><div className="skeleton" style={{ height: 20 }} /></td>
                </tr>
              ))}

            {data && users.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">مفيش يوزرات</td>
              </tr>
            )}

            {users.map((u) => (
              <tr key={u.id}>
                <td className="username" dir="ltr">{u.username}</td>
                <td><span className="chip">{u.gameId}</span></td>
                <td>
                  <div className="status-cell">
                    <StatusBadge user={u} />
                    {u.securityEvent && (
                      <button className="badge badge-warning badge-btn" onClick={() => open.clearAlert(u)}
                        title={formatDateTime(u.securityEvent.at)}>
                        <span className="dot dot-warning" aria-hidden="true" /> تنبيه أمني
                      </button>
                    )}
                  </div>
                </td>
                <td title={formatDateTime(u.lastActive)}>{u.online || u.lastActive ? timeAgo(u.lastActive) : "—"}</td>
                <td title={formatDateTime(u.lastLoginAt)}>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "—"}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td className="actions">
                  <button className="btn btn-small" disabled={!u.online} onClick={() => open.kick(u)}
                    title={u.online ? "" : "مش أونلاين"}>
                    طرد
                  </button>
                  {u.banned ? (
                    <button className="btn btn-small" onClick={() => open.unban(u)}>فك الحظر</button>
                  ) : (
                    <button className="btn btn-small btn-danger-ghost" onClick={() => open.ban(u)}>حظر</button>
                  )}
                  <button className="btn btn-small" onClick={() => open.password(u)}>باسورد</button>
                  <button className="btn btn-small btn-danger-ghost" onClick={() => open.remove(u)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
          <span className="muted num">صفحة {formatNumber(page)} من {formatNumber(data.pages)}</span>
          <button className="btn btn-small" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}

      {modal && <Modal {...modal} onClose={() => setModal(null)} />}
    </section>
  );
}

const ALERT_TEXT = {
  REFRESH_TOKEN_REUSED: "حد استخدم refresh token قديم (غالباً اتسرق)",
  REFRESH_TOKEN_OTHER_DEVICE: "الـ refresh token اتستخدم من جهاز تاني",
  ACCESS_TOKEN_OTHER_DEVICE: "الـ access token اتستخدم من جهاز تاني",
};

function StatusBadge({ user }) {
  if (user.banned)
    return (
      <span className="badge badge-critical" title={user.banReason || ""}>
        <span className="dot dot-critical" aria-hidden="true" /> محظور
        {user.banReason && <span className="badge-note"> · {user.banReason}</span>}
      </span>
    );
  if (user.online)
    return (
      <span className="badge badge-good">
        <span className="dot dot-good" aria-hidden="true" /> أونلاين
      </span>
    );
  return (
    <span className="badge">
      <span className="dot dot-muted" aria-hidden="true" /> أوفلاين
    </span>
  );
}
