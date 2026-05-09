
import { useEffect, useMemo, useState } from "react";
import { api } from "../../src/lib/api";
import { Plus, Trash2, Wallet, Calculator } from "lucide-react";

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"];

function inr(n) {
  return "₹ " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Expenses() {
  const [data, setData] = useState({ items: [], total: 0, by_category: [] });
  const [cats, setCats] = useState([]);
  const [month, setMonth] = useState(thisMonth());
  const [categoryFilter, setCategoryFilter] = useState(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Calculator state
  const [calcExpr, setCalcExpr] = useState("");
  const [showCalc, setShowCalc] = useState(false);

  const load = async () => {
    const params = { month };
    if (categoryFilter) {
      params.category = categoryFilter;
    }
    const [r, c] = await Promise.all([
      api.get("/expenses", { params }),
      api.get("/expenses/categories"),
    ]);
    setData(r.data); setCats(c.data);
    if (!c.data.includes(category)) setCategory(c.data[0]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month, categoryFilter]);

  const add = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    await api.post("/expenses", { amount: amt, category, description: desc, date });
    setAmount(""); setDesc(""); load();
  };

  const remove = async (id) => { await api.delete(`/expenses/${id}`); load(); };

  // Calculator handlers
  const press = (k) => {
    setCalcExpr((s) => s + k);
  };
  const evalExpr = () => {
    try {
      // safe simple eval: only digits + - * / . ( )
      if (!/^[0-9+*/.() -]*$/.test(calcExpr)) { setCalcExpr("Err"); return; }
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${calcExpr})`)();
      const num = Number(v);
      if (isFinite(num)) {
        setCalcExpr(String(Number(num.toFixed(4))));
      } else setCalcExpr("Err");
    } catch (_) { setCalcExpr("Err"); }
  };
  const useCalcResult = () => {
    if (calcExpr && /^[0-9.]+$/.test(calcExpr)) setAmount(calcExpr);
    setShowCalc(false);
  };

  const total = data.total;
  const totalForBars = useMemo(
    () => data.by_category.reduce((s, c) => Math.max(s, c.amount), 0) || 1,
    [data.by_category]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 max-w-6xl mx-auto" data-testid="expenses-root">
      <aside className="space-y-4">
        <div className="flex flex-col gap-3">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="expense-month" />
          <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Total spent</p>
            <p className="text-2xl font-semibold" data-testid="expense-total">{inr(total)}</p>
          </div>
        </div>

        <div>
          <p className="label-tiny mb-2">Categories</p>
          <button onClick={() => setCategoryFilter(null)}
            className={`w-full text-left text-sm py-1.5 px-2 rounded ${!categoryFilter ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
            All categories
          </button>
          {cats.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`w-full text-left text-sm py-1.5 px-2 rounded flex items-center gap-2 ${categoryFilter === c ? "bg-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--secondary))]"}`}>
              {c}
            </button>
          ))}
        </div>
      </aside>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Wallet />
          <h1 className="text-3xl font-semibold tracking-tight">Expenses</h1>
        </div>

        {/* The rest of the content remains in the main area */}
      <form onSubmit={add} className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-6 gap-2" data-testid="expense-form">
        <div className="sm:col-span-2 flex gap-2">
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₹)" className="flex-1 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="expense-amount" required />
          <button type="button" onClick={() => setShowCalc(!showCalc)} title="Calculator" className="px-3 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]" data-testid="expense-calc-toggle"><Calculator size={16} /></button>
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:col-span-1 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="expense-category">
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="sm:col-span-2 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="expense-desc" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:col-span-1 px-3 py-2 rounded-md bg-background border border-[hsl(var(--border))]" data-testid="expense-date" />
        <button className="sm:col-span-6 px-4 py-2 rounded-md bg-foreground text-background flex items-center justify-center gap-2" data-testid="expense-add"><Plus size={16} /> Add expense</button>
      </form>

      {showCalc && (
        <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 max-w-sm" data-testid="calculator-panel">
          <div className="px-3 py-2 mb-2 rounded-md bg-background border border-[hsl(var(--border))] text-right text-xl font-mono min-h-[2.5rem]" data-testid="calc-display">{calcExpr || "0"}</div>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {[
              ["7","8","9","/"],
              ["4","5","6","*"],
              ["1","2","3","-"],
              ["0",".","(","+"],
            ].flat().map((k) => (
              <button key={k} onClick={() => press(k)} className="py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]" data-testid={`calc-key-${k}`}>{k}</button>
            ))}
            <button onClick={() => press(")")} className="py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]">)</button>
            <button onClick={() => setCalcExpr("")} className="py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]" data-testid="calc-clear">C</button>
            <button onClick={() => setCalcExpr((s) => s.slice(0, -1))} className="py-2 rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]">⌫</button>
            <button onClick={evalExpr} className="py-2 rounded-md bg-foreground text-background col-span-1" data-testid="calc-equals">=</button>
          </div>
          <button onClick={useCalcResult} className="mt-2 w-full py-2 rounded-md bg-foreground text-background" data-testid="calc-use-result">Use as amount</button>
        </div>
      )}

      <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg p-4 space-y-2">
        <h3 className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">By category</h3>
        {data.by_category.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No data for this month.</p>}
        <div className="space-y-2">
          {data.by_category.map((c, i) => {
            const pct = Math.round((c.amount / totalForBars) * 100);
            const pctTotal = total ? Math.round((c.amount / total) * 100) : 0;
            return (
              <div key={c.category} data-testid={`expense-cat-${c.category}`}>
                <div className="flex items-center justify-between text-sm">
                  <span>{c.category} <span className="text-xs text-[hsl(var(--muted-foreground))]">· {pctTotal}%</span></span>
                  <span className="font-semibold">{inr(c.amount)}</span>
                </div>
                <div className="h-2 mt-1 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Entries</h3>
        <ul className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-lg divide-y divide-[hsl(var(--border))]">
          {data.items.length === 0 && <li className="p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No expenses logged.</li>}
          {data.items.map((e) => (
            <li key={e.id} className="p-3 flex items-center gap-3" data-testid={`expense-item-${e.id}`}>
              <span className="text-xs px-2 py-0.5 rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">{e.category}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{e.description || e.category}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{e.date}</p>
              </div>
              <span className="font-semibold">{inr(e.amount)}</span>
              <button onClick={() => remove(e.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-400"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}

Expenses.isProtected = true;