import Link from "next/link"; // Use next/link for client-side transitions
import { useRouter } from "next/router"; // Use next/router for active state and programmatic navigation
import { useState } from "react"; // State for mobile sidebar open/close
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { LayoutDashboard, CheckSquare, FileText, Flame, Apple, LogOut, Moon, Sun, Menu, X, Dumbbell, ShoppingCart, Wallet, Palette, CalendarDays } from "lucide-react"; // Import Lucide icons, added CalendarDays

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/app/notes", label: "Notes", icon: FileText },
  { to: "/app/habits", label: "Habits", icon: Flame },
  { to: "/app/nutrition", label: "Nutrition", icon: Apple },
  { to: "/app/gym", label: "Gym", icon: Dumbbell },
  { to: "/app/shopping", label: "Shopping", icon: ShoppingCart },
  { to: "/app/expenses", label: "Expenses", icon: Wallet },
  { to: "/app/hobbies", label: "Hobbies", icon: Palette },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const router = useRouter(); 

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 border-r bg-[hsl(var(--card))] flex-col transform transition-transform
        ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:flex`} // Conditional classes for sidebar visibility
        data-testid="sidebar"
      >
        <div className="h-16 px-6 flex items-center justify-between border-b">
          {typeof "/app/dashboard" === 'string' && ( // Defensive check for href
            <Link href="/app/dashboard" className="font-heading text-lg font-semibold tracking-tight" data-testid="brand-link">
              Prototask
            </Link>
          )} {/* Brand link */}
          <button className="lg:hidden" onClick={() => setOpen(false)} data-testid="sidebar-close">
            <X size={18} /> {/* Close button for mobile sidebar */}
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              // Use Next.js Link component for navigation
              key={to}
              href={to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                 ${router.pathname === to // Check if current path matches link's href
                    ? "bg-[hsl(var(--secondary))] text-foreground" // Active styles
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-foreground"}`
              }
              data-testid={`sidebar-nav-${label.toLowerCase()}`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t space-y-1">
          <div className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            <div className="truncate font-medium text-foreground" data-testid="current-user-name">{user?.name}</div> {/* Display current user's name */}
            <div className="truncate">{user?.email}</div>
          </div>
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-foreground"
            data-testid="theme-toggle-button"
          > {/* Theme toggle button */}
            {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button // Logout button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-foreground"
            data-testid="logout-button"
          >
            <LogOut size={16}/> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay for sidebar when open */}
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 px-4 lg:px-8 flex items-center justify-between border-b bg-[hsl(var(--background))] sticky top-0 z-20">
          <button onClick={() => setOpen(true)} className="lg:hidden" data-testid="sidebar-open">
            <Menu size={20} />
          </button>
          <div className="hidden lg:block label-tiny" data-testid="topbar-route">{router.pathname.split("/").pop()}</div> {/* Display current route name */}
          <div className="lg:hidden font-heading font-semibold">Prototask</div>
          <div />
        </header>
        <main className="flex-1 p-4 lg:p-8 fade-in">{children}</main>
      </div>
    </div>
  );
}