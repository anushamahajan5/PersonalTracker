
import { useEffect, useState } from "react";
import { api } from "../../src/lib/api";
import { Plus, Trash2, ShoppingCart, Trash } from "lucide-react";

const CATS = ["General", "Groceries", "Household", "Personal", "Tech", "Other"];

export default function Shopping() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [cat, setCat] = useState("General");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [purchasedFilter, setPurchasedFilter] = useState(null); // null for all, true for purchased, false for pending

  const load = () => api.get("/shopping", { params: { category: categoryFilter, purchased: purchasedFilter } }).then((r) => setItems(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [categoryFilter, purchasedFilter]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/shopping", { name, qty, category: cat });
    setName(""); setQty(""); load();
  };

  const togglePurchased = async (it) => {
    await api.patch(`/shopping/${it.id}`, { purchased: !it.purchased });
    setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, purchased: !x.purchased } : x)));
  };

  const remove = async (id) => { await api.delete(`/shopping/${id}`); load(); };
  const clearPurchased = async () => { await api.post("/shopping/clear-purchased"); load(); };

  const grouped = items.reduce((acc, it) => {
    const k = it.category || "General";
    (acc[k] = acc[k] || []).push(it);
    return acc;
  }, {});

  const pending = items.filter((i) => !i.purchased).length;
  const purchased = items.length - pending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 max-w-6xl mx-auto" data-testid="shopping-root">
      <aside className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <Stat label="Pending" value={pending} />
          <Stat label="Purchased" value={purchased} />
        </div>

        <div>
          <p className="label-tiny mb-2">Categories</p>
          <button onClick={() => setCategoryFilter(null)}
            className={`w-full text-left text-sm py-1.5 px-2 rounded ${!categoryFilter ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
            All categories
          </button>
          {CATS.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`w-full text-left text-sm py-1.5 px-2 rounded flex items-center gap-2 ${categoryFilter === c ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
              {c}
            </button>
          ))}
        </div>

        <div>
          <p className="label-tiny mb-2">Status</p>
          <button onClick={() => setPurchasedFilter(null)}
            className={`w-full text-left text-sm py-1.5 px-2 rounded ${purchasedFilter === null ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
            All items
          </button>
          <button onClick={() => setPurchasedFilter(false)}
            className={`w-full text-left text-sm py-1.5 px-2 rounded ${purchasedFilter === false ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
            Pending
          </button>
          <button onClick={() => setPurchasedFilter(true)}
            className={`w-full text-left text-sm py-1.5 px-2 rounded ${purchasedFilter === true ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
            Purchased
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart />
          <h1 className="text-3xl font-semibold tracking-tight">Shopping list</h1>
        </div>

        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-3" data-testid="shopping-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" className="flex-1 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="shopping-name" />
          <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty (e.g. 2 kg)" className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))] sm:w-40" data-testid="shopping-qty" />
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="shopping-cat">
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="px-4 py-2 rounded-md bg-foreground text-background flex items-center gap-2" data-testid="shopping-add"><Plus size={16} /> Add</button>
        </form>

        {purchased > 0 && (
          <button onClick={clearPurchased} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-400 flex items-center gap-1" data-testid="shopping-clear-purchased">
            <Trash size={12} /> Clear purchased ({purchased})
          </button>
        )}

        {Object.entries(grouped).map(([k, arr]) => (
          <div key={k} className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{k}</h3>
            <ul className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg divide-y divide-[hsl(var(--border))]">
              {arr.map((it) => (
                <li key={it.id} className="p-3 flex items-center gap-3" data-testid={`shopping-item-${it.id}`}>
                  <input type="checkbox" checked={it.purchased} onChange={() => togglePurchased(it)} className="w-4 h-4 accent-foreground" data-testid={`shopping-toggle-${it.id}`} />
                  <span className={`flex-1 ${it.purchased ? "line-through text-[hsl(var(--muted-foreground))]" : ""}`}>
                    {it.name} {it.qty && <span className="text-xs text-[hsl(var(--muted-foreground))]">· {it.qty}</span>}
                  </span>
                  <button onClick={() => remove(it.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-400"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">No items yet.</p>}
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

Shopping.isProtected = true;