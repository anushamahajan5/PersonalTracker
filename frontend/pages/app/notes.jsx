import { useEffect, useMemo, useState } from "react";
import { api } from "../../src/lib/api"; // Corrected import path
import { Plus, Trash2, Search, Folder as FolderIcon, Hash, Download } from "lucide-react";

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [active, setActive] = useState(null);
  const [q, setQ] = useState(""); // Search query state
  const [folderFilter, setFolderFilter] = useState(null);
  const [tagFilter, setTagFilter] = useState(null); // Filter notes by tag

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (folderFilter) params.folder_id = folderFilter;
    if (tagFilter) params.tag = tagFilter;
    const [n, f] = await Promise.all([
      api.get("/notes", { params }),
      api.get("/folders"),
    ]);
    setNotes(n.data); setFolders(f.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, folderFilter, tagFilter]);

  const createNote = async () => {
    const { data } = await api.post("/notes", { // Create a new note
      title: "Untitled", content: "", folder_id: folderFilter, tags: []
    });
    setNotes([data, ...notes]); setActive(data);
  };

  const createFolder = async () => {
    const name = prompt("Folder name");
    if (!name) return; // Don't create folder if name is empty
    const { data } = await api.post("/folders", { name });
    setFolders([...folders, data]);
  };

  const save = async (updates) => {
    if (!active) return;
    const { data } = await api.patch(`/notes/${active.id}`, updates);
    setActive(data); // Update active note with saved data
    setNotes((ns) => ns.map((n) => (n.id === data.id ? data : n)));
  };

  const remove = async (id) => {
    await api.delete(`/notes/${id}`);
    setNotes(notes.filter((n) => n.id !== id));
    if (active?.id === id) setActive(null);
  };

  const allTags = useMemo(() => {
    const s = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => s.add(t)));
    return [...s];
  }, [notes]);

  const download = () => window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/export/notes`, "_blank"); // Function to download notes

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 max-w-6xl mx-auto" data-testid="notes-root">
      <aside className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={createNote} className="flex-1 h-10 rounded-md bg-white text-black text-sm font-medium flex items-center justify-center gap-2" data-testid="note-create-button">
            <Plus size={14}/> New note
          </button> {/* Button to create a new note */}
          <button onClick={download} className="h-10 px-3 rounded-md border" data-testid="export-notes-button"><Download size={14}/></button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label-tiny">Folders</p>
            <button onClick={createFolder} className="text-[hsl(var(--muted-foreground))] hover:text-foreground" data-testid="folder-create-button"><Plus size={14}/></button>
          </div>
          <button onClick={() => setFolderFilter(null)} // Button to show all notes (no folder filter)
            className={`w-full text-left text-sm py-1.5 px-2 rounded ${!folderFilter ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
            All notes
          </button>
          {folders.map((f) => ( // List of folders
            <button key={f.id} onClick={() => setFolderFilter(f.id)}
              className={`w-full text-left text-sm py-1.5 px-2 rounded flex items-center gap-2 ${folderFilter === f.id ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
              data-testid={`folder-${f.id}`}>
              <FolderIcon size={14}/> {f.name}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div>
            <p className="label-tiny mb-2">Tags</p>
            <div className="flex flex-wrap gap-1"> {/* Display all unique tags */}
              {allTags.map((t) => (
                <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  className={`text-xs px-2 py-1 rounded border ${tagFilter === t ? "bg-white text-black" : "hover:bg-[hsl(var(--secondary))]"}`}>
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={14}/> {/* Search icon */}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..."
              className="w-full h-10 pl-9 pr-3 rounded-md bg-[hsl(var(--card))] border outline-none focus:border-[hsl(var(--ring))]"
              data-testid="note-search-input"/>
          </div>
          <div className="rounded-lg border bg-[hsl(var(--card))] divide-y max-h-[70vh] overflow-auto" data-testid="note-list">
            {notes.length === 0 ? ( // Display message if no notes
              <div className="p-6 text-sm text-center text-[hsl(var(--muted-foreground))]">No notes</div>
            ) : notes.map((n) => (
              <button key={n.id} onClick={() => setActive(n)}
                className={`w-full text-left p-3 ${active?.id === n.id ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}
                data-testid={`note-item-${n.id}`}> {/* Individual note item in the list */}
                <p className="font-medium truncate">{n.title || "Untitled"}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{(n.content || "").replace(/[#*`>-]/g, "").slice(0, 60)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--card))] p-6" data-testid="note-editor-card">
          {active ? (
            <NoteEditor key={active.id} note={active} folders={folders} onSave={save} onDelete={() => remove(active.id)}/>
          ) : ( // Display message if no note is selected
            <div className="py-24 text-center text-[hsl(var(--muted-foreground))]">Select or create a note</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ note, folders, onSave, onDelete }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState((note.tags || []).join(", ")); // Tags as a comma-separated string
  const [folderId, setFolderId] = useState(note.folder_id || "");

  const commit = () => onSave({
    title, content,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    folder_id: folderId || null,
  });

  return (
    <div className="space-y-4" data-testid="note-editor">
      <input
        value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commit}
        className="w-full bg-transparent font-heading text-3xl font-semibold tracking-tight outline-none"
        data-testid="note-title-input"
      /> {/* Note title input */}
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <select value={folderId} onChange={(e) => { setFolderId(e.target.value); onSave({ folder_id: e.target.value || null }); }}
          className="h-9 px-2 rounded-md bg-[hsl(var(--background))] border" data-testid="note-folder-select">
          <option value="">No folder</option> {/* Option for no folder */}
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select> {/* Folder selection dropdown */}
        <div className="flex items-center gap-1 flex-1 min-w-[200px]">
          <Hash size={14} className="text-[hsl(var(--muted-foreground))]"/>
          <input value={tags} onChange={(e) => setTags(e.target.value)} onBlur={commit}
            placeholder="tag1, tag2"
            className="flex-1 h-9 px-2 rounded-md bg-[hsl(var(--background))] border outline-none"
            data-testid="note-tags-input"/>
        </div>
        <button onClick={onDelete} className="h-9 px-3 rounded-md border text-[hsl(var(--destructive))] flex items-center gap-2" data-testid="note-delete-button"> {/* Delete note button */}
          <Trash2 size={14}/> Delete
        </button>
      </div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        Tip: use # for headings, - for bullets, [ ] for checklists
      </div>
      <textarea
        value={content} onChange={(e) => setContent(e.target.value)} onBlur={commit}
        placeholder="Start writing..."
        className="note-editor w-full bg-transparent border-0 outline-none resize-none text-base"
        rows={18}
        data-testid="note-content-input" // Note content textarea
      />
    </div>
  );
}

Notes.isProtected = true;