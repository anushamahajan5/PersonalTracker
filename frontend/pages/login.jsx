import { useRouter } from "next/router"; // Use next/router for navigation
import Link from "next/link"; // Use next/link for client-side transitions
import { useState } from "react";
import { useAuth } from "../src/lib/auth"; // Corrected import path

export default function Login() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // Handles form submission for user login
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(email, password);
    setBusy(false);
    if (ok) router.push("/app/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md fade-in">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight mb-2">Sign in</h1>
        <p className="text-[hsl(var(--muted-foreground))] mb-8">Welcome back. Your stack is waiting.</p>
        <form onSubmit={submit} className="space-y-4" data-testid="login-form">
          <div>
            <label className="label-tiny block mb-2">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-[hsl(var(--background))] border focus:border-[hsl(var(--ring))] outline-none"
              data-testid="login-email-input"
            />
          </div>
          <div>
            <label className="label-tiny block mb-2">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-[hsl(var(--background))] border focus:border-[hsl(var(--ring))] outline-none"
              data-testid="login-password-input"
            />
          </div>
          {error && <div className="text-sm text-[hsl(var(--destructive))]" data-testid="login-error">{error}</div>}
          <button
            type="submit" disabled={busy}
            className="w-full h-11 rounded-md bg-white text-black font-medium hover:bg-gray-200 transition-colors disabled:opacity-60"
            data-testid="login-submit-button"
          > {/* Submit button for login */}
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          No account?{" "}
          <Link href="/register" className="text-foreground underline" data-testid="link-to-register">Create one</Link>
        </p> {/* Link to registration page */}
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Demo: user@example.com / user123 {/* Demo credentials */}
        </p>
      </div>
    </div>
  );
}

Login.isGuestOnly = true;