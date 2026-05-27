import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useUserStore } from '../stores/useUserStore';
import { useProgressStore } from '../stores/useProgressStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const profile     = useUserStore((s) => s.profile);
  const loadHistory = useProgressStore((s) => s.loadHistory);

  useEffect(() => {
    loadHistory();
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index"               options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/welcome"      options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/onboarding"   options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"              options={{ headerShown: false }} />
        <Stack.Screen name="zone/[id]"           options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="session/[sessionId]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings"            options={{ headerShown: false, animation: 'slide_from_right'  }} />
        <Stack.Screen name="premium"             options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
