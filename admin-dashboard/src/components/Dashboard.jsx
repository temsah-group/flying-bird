import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../api.js";
import { formatNumber } from "../format.js";
import StatsCards from "./StatsCards.jsx";
import SignupsChart from "./SignupsChart.jsx";
import UsersTable from "./UsersTable.jsx";
import Toast from "./Toast.jsx";

const REFRESH_MS = 15000;

export default function Dashboard({ onLogout }) {
  const [games, setGames] = useState([]);
  const [gameId, setGameId] = useState("all");
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [tick, setTick] = useState(0); // bump to reload stats + users
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, kind = "ok") => setToast({ text, kind, id: Date.now() }), []);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    api.games().then((d) => setGames(d.games)).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .stats(gameId === "all" ? "" : gameId)
      .then((d) => {
        if (!alive) return;
        setStats(d.stats);
        setStatsError("");
      })
      .catch((e) => alive && setStatsError(errorText(e)));
    return () => {
      alive = false;
    };
  }, [gameId, tick]);

  // Auto refresh (new logins keep coming)
  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🐦</span>
          <div>
            <h1>Flying Bird</h1>
            <p className="muted">لوحة تحكم الأدمن</p>
          </div>
        </div>

        <div className="topbar-actions">
          <label className="select-wrap">
            <span className="sr-only">اللعبة</span>
            <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
              <option value="all">كل الألعاب</option>
              {games.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={reload} title="تحديث">↻ تحديث</button>
          <button className="btn btn-ghost" onClick={onLogout}>خروج</button>
        </div>
      </header>

      <main className="content">
        {statsError && <p className="banner-error" role="alert">{statsError}</p>}

        <StatsCards stats={stats} />

        <div className="grid-2">
          <SignupsChart data={stats ? stats.loginsPerDay : null} />
          <PerGame stats={stats} />
        </div>

        <UsersTable gameId={gameId} games={games} tick={tick} onChanged={reload} notify={notify} />
      </main>

      {toast && <Toast key={toast.id} {...toast} onDone={() => setToast(null)} />}
    </div>
  );
}

function PerGame({ stats }) {
  const rows = stats ? stats.perGame : [];
  const max = Math.max(1, ...rows.map((r) => r.users));
  return (
    <section className="card">
      <h2 className="card-title">الحسابات في كل لعبة</h2>
      {!stats ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : (
        <ul className="per-game">
          {rows.map((r) => (
            <li key={r.gameId}>
              <div className="per-game-head">
                <span>{r.gameId}</span>
                <span className="num">{formatNumber(r.users)}</span>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${(r.users / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
