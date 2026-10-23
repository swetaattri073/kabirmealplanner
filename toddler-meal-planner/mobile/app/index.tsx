import { Redirect } from 'expo-router';
import { useAuth } from '../src/AuthContext';

export default function Index() {
  const { ready, toddlers, activeToddler, authenticated } = useAuth();

  if (!ready) {
    return null;
  }

  if (activeToddler || toddlers.length > 0) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  if (authenticated) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/welcome" />;
}
