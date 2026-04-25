import { useRouter } from "next/router";
import "../src/styles/index.css"; // Path to global CSS
import { AuthProvider, useAuth } from "../src/lib/auth";
import { ThemeProvider } from "../src/lib/theme";
import AppShell from "../src/components/appShell";
import { Toaster } from "sonner";

function Protected({ Component, pageProps }) {
  const { user } = useAuth();
  const router = useRouter();

  if (user === null) {
    return <div className="min-h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))]">Loading…</div>;
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  return <AppShell><Component {...pageProps} /></AppShell>;
}

function GuestOnly({ Component, pageProps }) {
  const { user } = useAuth();
  const router = useRouter();

  if (user === null) return null;
  if (user) {
    router.replace("/app/dashboard");
    return null;
  }
  return <Component {...pageProps} />;
}

export default function MyApp({ Component, pageProps }) {
  const isGuestOnlyPage = Component.isGuestOnly;
  const isProtectedPage = Component.isProtected;

  return (
    <ThemeProvider>
      <AuthProvider>
        {isGuestOnlyPage ? (<GuestOnly Component={Component} pageProps={pageProps} />) :
         isProtectedPage ? (<Protected Component={Component} pageProps={pageProps} />) :
         (<Component {...pageProps} />)}
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}
