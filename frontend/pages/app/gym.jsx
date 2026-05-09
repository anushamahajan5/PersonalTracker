import { useEffect, useState } from "react";
import { api } from "../../src/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Dumbbell, Save, Library } from "lucide-react";

const MUSCLES = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Full Body"];

function emptyExercise() {
  return { name: "", muscle_group: "", notes: "", sets: [{ weight: 0, reps: 0 }] };
}

export default function Gym() {
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState(null);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("Chest");
  const [exercises, setExercises] = useState([emptyExercise()]);
  const [duration, setDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [userWeight, setUserWeight] = useState(""); // New state for user's body weight

  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [tplName, setTplName] = useState("");

  const load = async () => {
    const [s, t, st] = await Promise.all([
      api.get("/gym/sessions"), api.get("/gym/templates"), api.get("/gym/stats"),
    ]);
    setSessions(s.data); setTemplates(t.data); setStats(st.data);
  };
  useEffect(() => { load(); }, []);

  const addExercise = () => setExercises([...exercises, emptyExercise()]);
  const removeExercise = (i) => setExercises(exercises.filter((_, idx) => idx !== i));
  const updateExercise = (i, field, val) => {
    const arr = [...exercises]; arr[i] = { ...arr[i], [field]: val }; setExercises(arr);
  };
  const addSet = (i) => {
    const arr = [...exercises];
    arr[i] = { ...arr[i], sets: [...arr[i].sets, { weight: 0, reps: 0 }] };
    setExercises(arr);
  };
  const removeSet = (i, si) => {
    const arr = [...exercises];
    arr[i] = { ...arr[i], sets: arr[i].sets.filter((_, x) => x !== si) };
    setExercises(arr);
  };
  const updateSet = (i, si, field, val) => {
    const arr = [...exercises];
    const sets = [...arr[i].sets];
    sets[si] = { ...sets[si], [field]: Number(val) || 0 };
    arr[i] = { ...arr[i], sets };
    setExercises(arr);
  };

  const reset = () => {
    setTitle(""); setMuscleGroup("Chest"); setExercises([emptyExercise()]); setDuration(0); setNotes("");
    setUserWeight(""); // Reset user weight
  };

  const saveSession = async () => {
    if (!exercises.some((e) => e.name.trim())) { toast.error("Add at least one exercise"); return; }
    await api.post("/gym/sessions", {
      date, title, muscle_group: muscleGroup, exercises, notes, duration_min: Number(duration) || 0, 
      user_weight: Number(userWeight) || 0, // Include user weight
    });
    toast.success("Workout logged");
    reset(); load();
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) return;
    await api.post("/gym/templates", { name: tplName, muscle_group: muscleGroup, exercises, notes });
    toast.success("Template saved");
    setTplName(""); setShowSaveTpl(false); load();
  };

  const useTemplate = (t) => {
    setMuscleGroup(t.muscle_group || "Chest");
    setExercises(t.exercises?.length ? t.exercises : [emptyExercise()]);
    setNotes(t.notes || "");
    setTitle(t.name);
    toast.success(`Loaded template: ${t.name}`);
  };

  const deleteTemplate = async (id) => { await api.delete(`/gym/templates/${id}`); load(); };
  const deleteSession = async (id) => { await api.delete(`/gym/sessions/${id}`); load(); };

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="gym-root">
      <div className="flex items-center gap-3">
        <Dumbbell />
        <h1 className="text-3xl font-semibold tracking-tight">Gym</h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Sessions (30d)" value={stats.sessions} />
          <Stat label="Volume (kg)" value={stats.total_volume_kg.toLocaleString()} />
          <Stat label="Top muscle" value={stats.by_muscle[0]?.muscle || "—"} />
          <Stat label="Templates" value={templates.length} />
        </div>
      )}

      {/* Templates */}
      <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium"><Library size={14} /> Templates</div>
        {templates.length === 0 && <p className="text-xs text-[hsl(var(--muted-foreground))]">No templates yet — save one below for quick reuse.</p>}
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-[hsl(var(--border))] bg-background text-sm" data-testid={`gym-template-${t.id}`}>
              <button onClick={() => useTemplate(t)} className="hover:text-foreground">{t.name}</button>
              <button onClick={() => deleteTemplate(t.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-400 ml-1"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Builder */}
      <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 space-y-4" data-testid="gym-builder">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="gym-date" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Push day)" className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="gym-title" />
          <select value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="gym-muscle">
            {MUSCLES.map((m) => <option key={m}>{m}</option>)}
          </select> 
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration (min)" className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" />
        </div>

        <div className="space-y-3">
          {exercises.map((ex, i) => (
            <div key={i} className="border border-[hsl(var(--border))] rounded-md p-3 space-y-2" data-testid={`gym-exercise-${i}`}>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={ex.name} onChange={(e) => updateExercise(i, "name", e.target.value)} placeholder="Exercise name" className="flex-1 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" />
                <select value={ex.muscle_group || muscleGroup} onChange={(e) => updateExercise(i, "muscle_group", e.target.value)} className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]">
                  {MUSCLES.map((m) => <option key={m}>{m}</option>)}
                </select>
                <button onClick={() => removeExercise(i)} className="px-3 text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
              </div>
              <div className="space-y-1">
                {ex.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-[hsl(var(--muted-foreground))] w-12">Set {si + 1}</span>
                    <input type="number" value={s.weight} onChange={(e) => updateSet(i, si, "weight", e.target.value)} placeholder="kg" className="w-24 px-2 py-1 rounded-md bg-background border border-[hsl(var(--border))]" />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">×</span>
                    <input type="number" value={s.reps} onChange={(e) => updateSet(i, si, "reps", e.target.value)} placeholder="reps" className="w-24 px-2 py-1 rounded-md bg-background border border-[hsl(var(--border))]" />
                    <button onClick={() => removeSet(i, si)} className="text-[hsl(var(--muted-foreground))] hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                ))}
                <button onClick={() => addSet(i)} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground">+ Add set</button>
              </div>
              <input value={ex.notes || ""} onChange={(e) => updateExercise(i, "notes", e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-1.5 rounded-md bg-background border border-[hsl(var(--border))] text-sm" />
            </div>
          ))}
          <button onClick={addExercise} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-foreground flex items-center gap-1" data-testid="gym-add-exercise"><Plus size={14} /> Add exercise</button>
          <input type="number" value={userWeight} onChange={(e) => setUserWeight(e.target.value)} placeholder="Body weight (kg)" className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" />
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Session notes" rows={2} className="w-full px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" />

        <div className="flex flex-wrap gap-2">
          <button onClick={saveSession} className="px-4 py-2 rounded-md bg-foreground text-background flex items-center gap-2" data-testid="gym-save-session"><Save size={16} /> Log session</button>
          <button onClick={() => setShowSaveTpl(!showSaveTpl)} className="px-4 py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] flex items-center gap-2" data-testid="gym-save-template"><Library size={16} /> Save as template</button>
        </div>
        {showSaveTpl && (
          <div className="flex gap-2">
            <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name" className="flex-1 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="gym-template-name" />
            <button onClick={saveTemplate} className="px-4 py-2 rounded-md bg-foreground text-background" data-testid="gym-template-save-btn">Save</button>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="text-xl font-semibold mb-3">History</h2>
        {sessions.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No sessions yet.</p>}
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4" data-testid={`gym-session-${s.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{s.title || s.muscle_group || "Workout"}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.date} · {s.muscle_group} · {s.duration_min || 0} min {s.user_weight ? `· ${s.user_weight}kg` : ''}</p>
                </div>
                <button onClick={() => deleteSession(s.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-400"><Trash2 size={16} /></button>
              </div>
              <ul className="mt-2 text-sm space-y-1">
                {(s.exercises || []).map((ex, i) => (
                  <li key={i} className="text-[hsl(var(--muted-foreground))]">
                    <span className="text-foreground font-medium">{ex.name}</span>
                    {(ex.sets || []).length > 0 && " — " + ex.sets.map((st) => `${st.weight}kg × ${st.reps}`).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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

Gym.isProtected = true;