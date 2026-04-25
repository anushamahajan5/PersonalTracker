import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../src/lib/auth'; 

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth(); // Get user and loading state from AuthContext

  useEffect(() => {
    if (!loading) { 
      router.replace(user ? '/app/dashboard' : '/login'); // Redirect to dashboard if logged in, otherwise to login
    }
  }, [router, user, loading]); // Depend on user and loading state
  return null; 
}
