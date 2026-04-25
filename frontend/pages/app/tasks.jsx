import { useEffect, useState } from "react";
import { api } from "../../src/lib/api"; // Corrected import path
import { Plus, Trash2, Download, LayoutList, LayoutGrid } from "lucide-react";

const STATUSES = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];
const PRIORITIES = ["low", "medium", "high"];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("list"); // 'list' or 'kanban'
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");

  const load = () => api.get("/tasks").then((r) => setTasks(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post("/tasks", { title: title.trim(), priority, due_date: due || null, status: "todo" }); // Create a new task
    setTitle(""); setDue(""); setPriority("medium");
    load();
  };

  const patch = async (id, upd) => {
    await api.patch(`/tasks/${id}`, upd);
    load();
  };
  const remove = async (id) => { await api.delete(`/tasks/${id}`); load(); }; // Delete a task
  // Export tasks to CSV 
  const download = () => window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/export/tasks`, "_blank");

  const onDragStart = (e, id) => e.dataTransfer.setData("text/plain", id);
  const onDrop = (e, status) => {
    const id = e.dataTransfer.getData("text/plain");
    if (id) patch(id, { status }); // Update task status on drop
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-tiny mb-2">Workspace</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight">Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden" data-testid="view-switch">
            <button
              onClick={() => setView("list")} // Switch to list view
              className={`px-3 py-2 text-sm flex items-center gap-2 ${view === "list" ? "bg-[hsl(var(--secondary))]" : ""}`}
              data-testid="view-list"
            ><LayoutList size={14}/> List</button>
            <button
              onClick={() => setView("kanban")} // Switch to kanban view
              data-testid="view-kanban"
            ><LayoutGrid size={14}/> Kanban</button>
          </div>
          <button onClick={download} className="px-3 py-2 rounded-md border text-sm flex items-center gap-2" data-testid="export-tasks-button">
            <Download size={14}/> CSV
          </button>
        </div>
      </div>

      <form onSubmit={create} className="flex flex-wrap items-center gap-2 p-4 rounded-lg border bg-[hsl(var(--card))]" data-testid="task-create-form">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 min-w-[200px] h-10 px-3 rounded-md bg-[hsl(var(--background))] border outline-none focus:border-[hsl(var(--ring))]"
          data-testid="task-title-input"
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} // Priority dropdown
          className="h-10 px-2 rounded-md bg-[hsl(var(--background))] border" data-testid="task-priority-select">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} // Due date input
          className="h-10 px-2 rounded-md bg-[hsl(var(--background))] border" data-testid="task-due-input" />
        <button type="submit" className="h-10 px-4 rounded-md bg-white text-black font-medium flex items-center gap-2" data-testid="task-create-button">
          <Plus size={14}/> Add
        </button>
      </form>

      {view === "list" ? ( // List view for tasks
        <div className="rounded-lg border bg-[hsl(var(--card))] divide-y" data-testid="task-list">
          {tasks.length === 0 ? ( // Display message if no tasks
            <div className="p-10 text-center text-[hsl(var(--muted-foreground))] text-sm">No tasks yet.</div>
          ) : tasks.map((t) => (
            <div key={t.id} className="p-4 flex items-center gap-3" data-testid={`task-row-${t.id}`}>
              <input // Checkbox to mark task as done/undone
                type="checkbox" checked={t.status === "done"}
                onChange={() => patch(t.id, { status: t.status === "done" ? "todo" : "done" })}
                className="w-4 h-4"
                data-testid={`task-check-${t.id}`}
              />
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${t.status === "done" ? "line-through text-[hsl(var(--muted-foreground))]" : ""}`}>{t.title}</p> {/* Task title, strikethrough if done */}
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t.due_date || "no due"} · <span className={pColor(t.priority)}>{t.priority}</span>
                </p>
              </div>
              <select value={t.status} onChange={(e) => patch(t.id, { status: e.target.value })} // Status dropdown
                className="h-8 px-2 rounded-md bg-[hsl(var(--background))] border text-xs"
                data-testid={`task-status-${t.id}`}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button onClick={() => remove(t.id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" data-testid={`task-delete-${t.id}`}>
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
        </div>
      ) : ( // Kanban board view for tasks
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STATUSES.map((s) => (
            <div key={s.key} className="kanban-col rounded-lg border bg-[hsl(var(--card))] p-4"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, s.key)}
              data-testid={`kanban-col-${s.key}`}>
              <div className="flex items-center justify-between mb-4">
                <p className="label-tiny">{s.label}</p>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {tasks.filter((t) => t.status === s.key).length}
                </span>
              </div>
              <div className="space-y-2">
                {tasks.filter((t) => t.status === s.key).map((t) => (
                  <div key={t.id} draggable onDragStart={(e) => onDragStart(e, t.id)}
                    className="p-3 rounded-md border bg-[hsl(var(--background))] cursor-grab active:cursor-grabbing" // Draggable task card
                    data-testid={`kanban-card-${t.id}`}>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      <span className={pColor(t.priority)}>{t.priority}</span>{t.due_date ? ` · ${t.due_date}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pColor(p) {
  if (p === "high") return "text-[#EB5757]";
  if (p === "medium") return "text-[#F2C94C]";
  return "text-[#2D9CDB]";
}

Tasks.isProtected = true;