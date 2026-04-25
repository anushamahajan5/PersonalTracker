import { useRouter } from "next/router"; // Use next/router for navigation
import Link from "next/link"; // Use next/link for client-side transitions
import { useState } from "react";
import { useAuth } from "../src/lib/auth"; // Corrected import path

export default function Register() {
  const { register, error } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // Handles form submission for user registration
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await register(name, email, password);
    setBusy(false);
    if (ok) router.push("/app/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md fade-in">
        <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight mb-2">Create account</h1>
        <p className="text-[hsl(var(--muted-foreground))] mb-8">Start your daily stack in minutes.</p>
        <form onSubmit={submit} className="space-y-4" data-testid="register-form">
          <div>
            <label className="label-tiny block mb-2">Name</label>
            <input
              required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-[hsl(var(--background))] border focus:border-[hsl(var(--ring))] outline-none"
              data-testid="register-name-input"
            />
          </div>
          <div>
            <label className="label-tiny block mb-2">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-[hsl(var(--background))] border focus:border-[hsl(var(--ring))] outline-none"
              data-testid="register-email-input"
            />
          </div>
          <div>
            <label className="label-tiny block mb-2">Password</label>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-[hsl(var(--background))] border focus:border-[hsl(var(--ring))] outline-none"
              data-testid="register-password-input"
            />
          </div>
          {error && <div className="text-sm text-[hsl(var(--destructive))]" data-testid="register-error">{error}</div>} {/* Display registration error */}
          <button
            type="submit" disabled={busy}
            className="w-full h-11 rounded-md bg-white text-black font-medium hover:bg-gray-200 transition-colors disabled:opacity-60"
            data-testid="register-submit-button"
          > {/* Submit button for registration */}
            {busy ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline" data-testid="link-to-login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

Register.isGuestOnly = true;