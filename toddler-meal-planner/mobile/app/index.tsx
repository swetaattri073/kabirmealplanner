import { Redirect } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import { LoadingBlock, Screen } from '../src/components/ui';

export default function Index() {
  const { ready, toddlers, activeToddler } = useAuth();

  if (!ready) {
    return (
      <Screen>
        <LoadingBlock />
      </Screen>
    );
  }

  if (activeToddler || toddlers.length > 0) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/welcome" />;
}
