import { useEffect, useState } from "react";
import { api } from "../../src/lib/api"; 
import { useAuth } from "../../src/lib/auth"; 
import Link from "next/link"; 
import { Flame, Target, TrendingUp, Calendar, List } from "lucide-react"; 

function Card({ children, className = "", testid }) {
  return (
    <div
      className={`rounded-lg border bg-[hsl(var(--card))] p-6 transition-colors hover:border-[hsl(var(--border-hover))] ${className}`}
      data-testid={testid}
    >
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      Promise.all([
        api.get("/dashboard"),
        api.get("/insights/weekly")
      ])
        .then(([dashboardRes, insightsRes]) => {
          setD(dashboardRes.data);
          setInsights(insightsRes.data);
          setLoading(false);
        })
        .catch(err => {
          setError("Failed to load dashboard data.");
          setLoading(false);
          console.error("Dashboard fetch error:", err);
        });
    }
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))]">Loading…</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-[hsl(var(--destructive))]">{error}</div>;
  if (!d) return null;

  const pct = d.protein.pct;

  return (
    <div className="max-w-6xl mx-auto space-y-8 fade-in" data-testid="dashboard-root">
      {/* Header */}
      <div>
        <p className="label-tiny mb-2">Today</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">
          {greet()}, ready to ship?
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] mt-2">
          {d.task_stats.completion_pct}% of tasks shipped all-time · {d.overall_streak}-day streak
        </p>
      </div>

      {/* Top Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card testid="stat-streak" className="md:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <p className="label-tiny">Streak</p>
            <Flame size={16} className="text-[#F2C94C]" />
          </div>
          <div className="font-heading text-4xl font-semibold">{d.overall_streak}</div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">consecutive days</p>
        </Card>

        <Card testid="stat-protein" className="md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="label-tiny">Protein today</p>
            <Target size={16} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-4xl font-semibold">{d.protein.consumed.toFixed(0)}</span>
            <span className="text-[hsl(var(--muted-foreground))]\">/ {d.protein.goal} g</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} data-testid="protein-progress-bar" />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">{pct}% of daily goal</p>
        </Card>

        <Card testid="stat-habits">
          <div className="flex items-center justify-between mb-4">
            <p className="label-tiny">Habits</p>
            <TrendingUp size={16} />
          </div>
          <div className="font-heading text-4xl font-semibold">
            {d.habits.completed}<span className="text-[hsl(var(--muted-foreground))] text-2xl">/{d.habits.total}</span>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">done today</p>
        </Card>
      </div>

      {/* Bottom Row: Tasks & Weekly Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card testid="due-today-card" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-semibold">Due today</h2>
            <Link href="/app/tasks" className="text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground">View all →</Link>
          </div>
          {d.tasks_due_today.length === 0 ? (
            <div className="py-10 text-center text-[hsl(var(--muted-foreground))] text-sm italic">
              Nothing due today. Enjoy the calm.
            </div>
          ) : (
            <ul className="divide-y divide-[#2a2a2a]">
              {d.tasks_due_today.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between" data-testid={`due-task-${t.id}`}>
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{t.priority.toUpperCase()} · {t.status.replace("_", " ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card testid="weekly-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-semibold">This week</h2>
            <Calendar size={16} />
          </div>
          {insights ? (
            <div className="space-y-4">
              <Stat label="Habit check-ins" value={insights.habit_check_ins} />
              <Stat label="Avg protein" value={`${insights.avg_protein_g} g`} />
              <Stat label="Days goal hit" value={`${insights.days_protein_goal_hit}/7`} />
              <div className="flex items-end gap-1 h-16 pt-2 border-t border-[#2a2a2a]">
                {insights.protein_daily.map((day, i) => {
                  const h = Math.min(100, (day.protein_g / (insights.protein_goal || 1)) * 100);
                  return (
                    <div 
                      key={i} 
                      className="flex-1 bg-white/80 rounded-sm" 
                      style={{ height: `${Math.max(4, h)}%` }} 
                      title={`${day.date}: ${day.protein_g}g`} 
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">No weekly insights available.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-heading font-semibold">{value}</span>
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

Dashboard.isProtected = true;