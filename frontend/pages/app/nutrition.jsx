import { useEffect, useState } from "react";
import { api } from "../../src/lib/api"; // Corrected import path
import { useAuth } from "../../src/lib/auth"; // Corrected import path
import { Plus, Trash2, Sparkles, Download } from "lucide-react";

export default function Nutrition() {
  const { user, refreshUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("");
  const [protein, setProtein] = useState(""); // State for protein input
  const [carbs, setCarbs] = useState(""); // State for carbs input
  const [fats, setFats] = useState(""); // State for fats input
  const [kcal, setKcal] = useState(""); // State for calories input
  const [aiBusy, setAiBusy] = useState(false);
  // Initialize goal to empty string if user.protein_goal is undefined or null
  const [goal, setGoal] = useState(user?.protein_goal === undefined || user?.protein_goal === null ? "" : user.protein_goal);
  const [aiText, setAiText] = useState(""); // State for AI food input text
  const load = async () => {
    const [e, h] = await Promise.all([
      api.get("/protein/entries"),
      api.get("/protein/history", { params: { days: 14 } }),
    ]);
    setEntries(e.data); setHistory(h.data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (user) {
      // Update goal state, showing empty string if protein_goal is undefined or null
      setGoal(user.protein_goal === undefined || user?.protein_goal === null ? "" : user.protein_goal);
    }
  }, [user]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || !protein) return;
    await api.post("/protein/entries", { // Add new food entry
      name: name.trim(),
      protein_g: parseFloat(protein) || 0,
      carbs_g: parseFloat(carbs) || 0,
      fats_g: parseFloat(fats) || 0,
      calories: parseFloat(kcal) || 0,
    }); // Clear form fields
    setName(""); setProtein(""); setCarbs(""); setFats(""); setKcal("");
    load();
  };

  const remove = async (id) => { await api.delete(`/protein/entries/${id}`); load(); }; // Remove a food entry

  const aiFill = async () => {
    if (!aiText.trim()) return; // Don't proceed if AI input is empty
    setAiBusy(true);
  try {
    const { data } = await api.post("/protein/ai-parse", { text: aiText });
    setName(data.food_name);
    setProtein(String(data.protein_g));
    setCarbs(String(data.carbs_g));
    setFats(String(data.fats_g));
    setKcal(String(data.calories));
  } catch (e) {
    alert("AI parse failed. Try entering manually."); // Alert user if AI parsing fails
  } finally {
    setAiBusy(false);
  }
  }; // Function to fill form fields using AI

  const saveGoal = async () => {
    const newGoal = parseInt(goal);
    // Send null if the input is empty or results in NaN, so the backend can unset the field
    await api.patch("/auth/me", { protein_goal: isNaN(newGoal) ? null : newGoal });
    refreshUser();
  };

  const totals = entries.reduce(
    (a, e) => ({
      // Ensure e.protein_g, etc., are treated as numbers, defaulting to 0 if null/undefined
      // This is a good practice, though Pydantic models usually ensure types.
      protein: a.protein + (e.protein_g || 0),
      carbs: a.carbs + (e.carbs_g || 0),
      fats: a.fats + (e.fats_g || 0),
      kcal: a.kcal + (e.calories || 0),
    }),
    { protein: 0, carbs: 0, fats: 0, kcal: 0 }
  );

  // Calculate effective goal, defaulting to 1 to prevent division by zero if goal is not set
  const effectiveGoal = parseInt(goal) || 1;
  const pct = Math.min(100, Math.round((totals.protein / effectiveGoal) * 100));
  const download = () => window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/export/nutrition`, "_blank"); // Function to download nutrition data

  return (
    <div className="max-w-6xl mx-auto space-y-8 fade-in" data-testid="nutrition-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="label-tiny mb-2">Protein tracker</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">Nutrition</h1>
        </div>
        <button onClick={download} className="px-3 py-2 rounded-md border text-sm flex items-center gap-2" data-testid="export-nutrition-button"> {/* Export button */}
          <Download size={14}/> CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border bg-[hsl(var(--card))] p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="label-tiny">Today</p> {/* Label for today's summary */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">Goal</span>
              <input type="number" value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={saveGoal} // Input for protein goal
                className="w-20 h-8 px-2 rounded-md bg-[hsl(var(--background))] border text-right" data-testid="protein-goal-input"/> {/* Protein goal input */}
              <span className="text-[hsl(var(--muted-foreground))]">g</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-5xl font-semibold">{totals.protein.toFixed(0)}</span>
            <span className="text-[hsl(var(--muted-foreground))]">/ {goal} g protein</span>
          </div>
          <div className="mt-4 h-3 rounded-full bg-[#2a2a2a] overflow-hidden">
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} data-testid="protein-progress-bar"/> {/* Protein progress bar */}
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            <Macro label="Carbs" value={totals.carbs} unit="g"/>
            <Macro label="Fats" value={totals.fats} unit="g"/>
            <Macro label="Calories" value={totals.kcal} unit="kcal"/>
            <Macro label="Entries" value={entries.length} unit=""/>
          </div>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16}/>
            <p className="label-tiny">AI food input</p>
          </div>
          <textarea
            value={aiText} onChange={(e) => setAiText(e.target.value)}
            placeholder='Try "2 eggs and a slice of toast"'
            className="w-full h-20 p-3 rounded-md bg-[hsl(var(--background))] border outline-none focus:border-[hsl(var(--ring))] text-sm"
            data-testid="ai-input"
          />
          <button
            onClick={aiFill} disabled={aiBusy}
            className="mt-3 w-full h-10 rounded-md bg-white text-black font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            data-testid="ai-parse-button" // AI parse button
          > {/* AI button text changes based on busy state */}
            <Sparkles size={14}/> {aiBusy ? "Thinking..." : "Estimate macros"}
          </button>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
            Powered by Claude Sonnet 4.5
          </p>
        </div>
      </div>

      <form onSubmit={add} className="p-4 rounded-lg border bg-[hsl(var(--card))] grid grid-cols-2 md:grid-cols-6 gap-2" data-testid="food-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Food" // Food name input
          className="col-span-2 h-10 px-3 rounded-md bg-[hsl(var(--background))] border outline-none" data-testid="food-name-input"/>
        <input value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein g" type="number" // Protein input
          className="h-10 px-3 rounded-md bg-[hsl(var(--background))] border outline-none" data-testid="food-protein-input"/>
        <input value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs g" type="number" // Carbs input
          className="h-10 px-3 rounded-md bg-[hsl(var(--background))] border outline-none"/>
        <input value={fats} onChange={(e) => setFats(e.target.value)} placeholder="Fats g" type="number" // Fats input
          className="h-10 px-3 rounded-md bg-[hsl(var(--background))] border outline-none"/>
        <input value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="kcal" type="number" // Calories input
          className="h-10 px-3 rounded-md bg-[hsl(var(--background))] border outline-none"/>
        <button className="col-span-2 md:col-span-6 h-10 rounded-md bg-white text-black font-medium flex items-center justify-center gap-2" data-testid="food-add-button"> {/* Add food button */}
          <Plus size={14}/> Log food
        </button>
      </form>

      <div className="rounded-lg border bg-[hsl(var(--card))] divide-y" data-testid="food-entries">
        {entries.length === 0 ? ( // Display message if no entries
          <div className="p-10 text-center text-[hsl(var(--muted-foreground))] text-sm">No entries today</div>
        ) : entries.map((e) => (
          <div key={e.id} className="p-4 flex items-center gap-4" data-testid={`food-entry-${e.id}`}> {/* Individual food entry */}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{e.name}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" · "}{e.protein_g}g protein · {e.carbs_g}g C · {e.fats_g}g F · {e.calories} kcal
              </p>
            </div>
            <button onClick={() => remove(e.id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" data-testid={`food-delete-${e.id}`}>
              <Trash2 size={16}/>
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-[hsl(var(--card))] p-6">
        <h2 className="font-heading text-xl font-semibold mb-4">Last 14 days</h2>
        <div className="flex items-end gap-2 h-32">
          {history.map((d, i) => { // Render history bars
            const h = Math.min(100, (d.protein_g / Math.max(goal, 1)) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.protein_g}g`}>
                <div className="w-full bg-white/80 rounded-sm transition-all" style={{ height: `${Math.max(4, h)}%` }}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Macro({ label, value, unit }) {
  return (
    <div>
      <p className="label-tiny">{label}</p>
      <p className="font-heading text-xl font-semibold mt-1">
        {Math.round(value * 10) / 10}<span className="text-[hsl(var(--muted-foreground))] text-sm ml-1">{unit}</span>
      </p>
    </div>
  );
}

Nutrition.isProtected = true;