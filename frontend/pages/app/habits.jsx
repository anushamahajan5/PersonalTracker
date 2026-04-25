import { useEffect, useState, useMemo } from "react";
import { api } from "../../src/lib/api"; // Corrected import path
import { Plus, Trash2, Flame, Download } from "lucide-react";

export default function Habits() {
  const [habits, setHabits] = useState([]);
  const [heat, setHeat] = useState([]);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(""); // State for habit emoji

  const load = async () => {
    const [h, m] = await Promise.all([api.get("/habits"), api.get("/habits/heatmap", { params: { days: 140 } })]);
    setHabits(h.data); setHeat(m.data);
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/habits", { name: name.trim(), emoji }); // Create a new habit
    setName(""); setEmoji(""); load();
  };
  const toggle = async (id) => { await api.post(`/habits/${id}/toggle`); load(); }; // Toggle habit completion
  const remove = async (id) => { await api.delete(`/habits/${id}`); load(); }; // Delete a habit
  const download = () => window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/export/habits`, "_blank"); // Export habits to CSV

  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < heat.length; i += 7) w.push(heat.slice(i, i + 7));
    return w;
  }, [heat]);

  return ( // Main container for the Habits page
    <div className="max-w-6xl mx-auto space-y-8 fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="label-tiny mb-2">Consistency</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">Habits</h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-2">Stack small wins. Every day counts.</p>
        </div>
        <button onClick={download} className="px-3 py-2 rounded-md border text-sm flex items-center gap-2" data-testid="export-habits-button"> {/* Export button */}
          <Download size={14}/> CSV
        </button>
      </div>

      <form onSubmit={create} className="flex items-center gap-2 p-4 rounded-lg border bg-[hsl(var(--card))]" data-testid="habit-create-form">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🏋️"
          className="w-16 h-10 text-center rounded-md bg-[hsl(var(--background))] border" data-testid="habit-emoji-input"/>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Drink 2L water" // Habit name input
          className="flex-1 h-10 px-3 rounded-md bg-[hsl(var(--background))] border outline-none focus:border-[hsl(var(--ring))]"
          data-testid="habit-name-input"/>
        <button className="h-10 px-4 rounded-md bg-white text-black font-medium flex items-center gap-2" data-testid="habit-create-button">
          <Plus size={14}/> Add habit {/* Button to add a new habit */}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {habits.length === 0 && (
          <div className="md:col-span-2 p-10 text-center text-[hsl(var(--muted-foreground))] rounded-lg border bg-[hsl(var(--card))]"> {/* Message if no habits */}
            No habits yet. Add your first one above.
          </div>
        )}
        {habits.map((h) => (
          <div key={h.id} className="p-5 rounded-lg border bg-[hsl(var(--card))] flex items-center gap-4" data-testid={`habit-${h.id}`}>
            <button
              onClick={() => toggle(h.id)}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl transition-all // Habit toggle button styling
                ${h.done_today ? "bg-[#36B172] border-[#36B172] text-black" : "border-[hsl(var(--border))]"}`}
              data-testid={`habit-toggle-${h.id}`}
            >
              {h.emoji || (h.done_today ? "✓" : "")}
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{h.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                <Flame size={12} className="text-[#F2C94C]"/> {h.streak}-day streak {/* Streak display */}
              </p>
            </div>
            <button onClick={() => remove(h.id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" data-testid={`habit-delete-${h.id}`}>
              <Trash2 size={16}/>
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-[hsl(var(--card))] p-6" data-testid="habit-heatmap-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-semibold">Last 140 days</h2>
          <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]"> {/* Heatmap legend */}
            Less
            <span className="w-3 h-3 rounded-sm heat-0"/><span className="w-3 h-3 rounded-sm heat-1"/>
            <span className="w-3 h-3 rounded-sm heat-2"/><span className="w-3 h-3 rounded-sm heat-3"/>
            <span className="w-3 h-3 rounded-sm heat-4"/>
            More
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-1"> {/* Heatmap grid */}
            {weeks.map((w, i) => (
              <div key={i} className="flex flex-col gap-1">
                {w.map((d) => {
                  const lvl = d.count === 0 ? 0 : d.count === 1 ? 1 : d.count === 2 ? 2 : d.count <= 4 ? 3 : 4;
                  return (
                    <div key={d.date}
                      className={`w-3 h-3 sm:w-4 sm:h-4 rounded-sm heat-${lvl}`}
                      title={`${d.date}: ${d.count} check-in(s)`}
                      data-testid="habit-heatmap-cell"/>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Habits.isProtected = true;