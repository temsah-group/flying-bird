import { formatNumber } from "../format.js";

export default function StatsCards({ stats }) {
  const cards = [
    { key: "totalUsers", label: "إجمالي اليوزرات" },
    { key: "onlineNow", label: "أونلاين دلوقتي", dot: "good" },
    { key: "newToday", label: "اتسجلوا النهارده" },
    { key: "newLast7Days", label: "آخر 7 أيام" },
    { key: "bannedUsers", label: "محظورين", dot: "critical" },
    { key: "securityAlerts", label: "تنبيهات أمنية (7 أيام)", dot: "warning" },
  ];

  return (
    <section className="stats" aria-label="إحصائيات">
      {cards.map((c) => (
        <div className="stat" key={c.key}>
          <span className="stat-label">
            {c.dot && <span className={`dot dot-${c.dot}`} aria-hidden="true" />}
            {c.label}
          </span>
          {stats ? (
            <span className="stat-value num">{formatNumber(stats[c.key])}</span>
          ) : (
            <span className="skeleton" style={{ height: 34, width: 70 }} />
          )}
        </div>
      ))}
    </section>
  );
}
