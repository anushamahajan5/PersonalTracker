import { useEffect, useState } from "react";
import { api } from "../../src/lib/api"; // Corrected import path
import { useAuth } from "../../src/lib/auth"; // Corrected import path
import Link from "next/link"; // Use next/link for navigation

export default function Dashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      api.get("/dashboard")
        .then(response => {
          setDashboardData(response.data);
          setLoading(false);
        })
        .catch(err => {
          setError("Failed to load dashboard data.");
          setLoading(false);
          console.error("Dashboard data fetch error:", err);
        });
    }
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))]">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-[hsl(var(--destructive))]">{error}</div>;
  }

  if (!dashboardData) {
    return <div className="min-h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))]">No dashboard data available.</div>;
  }

  const {
    tasks_due_today,
    task_stats,
    habits,
    protein,
    overall_streak,
  } = dashboardData;

  return (
    <div className="max-w-6xl mx-auto space-y-8 fade-in" data-testid="dashboard-root">
      <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">Dashboard</h1>

      {/* Overall Streak */}
      <div className="rounded-lg border bg-[hsl(var(--card))] p-6">
        <p className="label-tiny mb-2">Overall Progress</p>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-5xl font-semibold">{overall_streak}</span>
          <span className="text-[hsl(var(--muted-foreground))]">day streak</span>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
          Consecutive days with at least one habit completed. Keep it up!
        </p>
      </div>

      {/* Tasks Summary */}
      <div className="rounded-lg border bg-[hsl(var(--card))] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-semibold">Tasks</h2>
          <Link href="/app/tasks" className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">View all tasks</Link>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {task_stats.done} of {task_stats.total} tasks completed ({task_stats.completion_pct}%)
        </p>
        {tasks_due_today.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="label-tiny">Due Today</p>
            {tasks_due_today.map(task => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={task.status === "done"} readOnly className="w-4 h-4" />
                <span className={task.status === "done" ? "line-through text-[hsl(var(--muted-foreground))]" : ""}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        )}
        {tasks_due_today.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-4">No tasks due today. Great job!</p>
        )}
      </div>

      {/* Habits Summary */}
      <div className="rounded-lg border bg-[hsl(var(--card))] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-semibold">Habits</h2>
          <Link href="/app/habits" className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">View all habits</Link>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {habits.completed} of {habits.total} habits completed today.
        </p>
      </div>

      {/* Protein Summary */}
      <div className="rounded-lg border bg-[hsl(var(--card))] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-semibold">Protein Intake</h2>
          <Link href="/app/nutrition" className="text-sm text-[hsl(var(--muted-foreground))] hover:underline">View nutrition</Link>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-5xl font-semibold">{protein.consumed.toFixed(0)}</span>
          <span className="text-[hsl(var(--muted-foreground))]">/ {protein.goal} g protein</span>
        </div>
        <div className="mt-4 h-3 rounded-full bg-[#2a2a2a] overflow-hidden">
          <div className="h-full bg-white transition-all duration-500" style={{ width: `${protein.pct}%` }} />
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
          {protein.calories.toFixed(0)} kcal consumed today.
        </p>
      </div>
    </div>
  );
}

Dashboard.isProtected = true;