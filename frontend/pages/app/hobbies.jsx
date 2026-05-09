import { useEffect, useState } from "react";
import { api } from "../../src/lib/api";
import { Plus, Trash2, Palette } from "lucide-react";
import { thisMonth } from "../../src/lib/utils"; // Assuming thisMonth is available or will be created

export default function Hobbies() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [hobbyNameFilter, setHobbyNameFilter] = useState(null);

  const load = async () => {
    const params = { month };
    if (hobbyNameFilter) {
      params.name = hobbyNameFilter;
    }
    const [a, b] = await Promise.all([api.get("/hobbies", { params }), api.get("/hobbies/stats", { params: { month } })]);
    setItems(a.data); setStats(b.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month, hobbyNameFilter]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/hobbies", { name, date, duration_min: Number(duration) || 0, notes });
    setName(""); setDuration(""); setNotes(""); load();
  };

  const remove = async (id) => { await api.delete(`/hobbies/${id}`); load(); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 max-w-4xl mx-auto" data-testid="hobbies-root">
      <aside className="space-y-4">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="hobby-month-filter" />

        {stats && (
          <div className="grid grid-cols-1 gap-3">
            <Stat label="Sessions (30d)" value={stats.entries} />
            <Stat label="Total minutes" value={stats.total_min} />
            <Stat label="Top hobby" value={stats.by_hobby[0]?.name || "—"} />
          </div>
        )}

        <div>
          <p className="label-tiny mb-2">Hobbies</p>
          <button onClick={() => setHobbyNameFilter(null)}
            className={`w-full text-left text-sm py-1.5 px-2 rounded ${!hobbyNameFilter ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
            All hobbies
          </button>
          {stats?.by_hobby.map((h) => (
            <button key={h.name} onClick={() => setHobbyNameFilter(h.name)}
              className={`w-full text-left text-sm py-1.5 px-2 rounded flex items-center gap-2 ${hobbyNameFilter === h.name ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
              {h.name}
            </button>
          ))}
        </div>

        {stats && stats.by_hobby.length > 0 && (
          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Time distribution (30d)</h3>
            {stats.by_hobby.map((h) => {
              const pct = stats.total_min ? Math.round((h.minutes / stats.total_min) * 100) : 0;
              return (
                <div key={h.name}>
                  <div className="flex justify-between text-sm">
                    <span>{h.name}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{h.minutes} min · {pct}%</span>
                  </div>
                  <div className="h-2 mt-1 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                    <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Palette />
          <h1 className="text-3xl font-semibold tracking-tight">Hobbies</h1>
        </div>

        <form onSubmit={add} className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-3 grid grid-cols-1 sm:grid-cols-5 gap-2" data-testid="hobby-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hobby name (e.g. Guitar)" className="sm:col-span-2 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="hobby-name" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="hobby-date" />
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Minutes" className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="hobby-duration" />
          <button className="px-4 py-2 rounded-md bg-foreground text-background flex items-center justify-center gap-2" data-testid="hobby-add"><Plus size={16} /> Log</button>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="sm:col-span-5 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" />
        </form>

        <div>
        <h3 className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Recent</h3>
        <ul className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg divide-y divide-[hsl(var(--border))]">
          {items.length === 0 && <li className="p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No hobby entries yet.</li>}
          {items.map((h) => (
            <li key={h.id} className="p-3 flex items-start gap-3" data-testid={`hobby-item-${h.id}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{h.name} <span className="text-xs text-[hsl(var(--muted-foreground))]">· {h.duration_min || 0} min</span></p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{h.date}{h.notes ? ` — ${h.notes}` : ""}</p>
              </div>
              <button onClick={() => remove(h.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-400"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

Hobbies.isProtected = true;