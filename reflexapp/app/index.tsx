import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useUserStore } from '../stores/useUserStore';

export default function Index() {
  const profile = useUserStore((s) => s.profile);

  if (!profile || !profile.onboardingCompleted) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
