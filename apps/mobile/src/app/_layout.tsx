/**
 * Root layout — wires the providers (Query, Theme, Session, SafeArea), hides
 * the splash screen once the session has been restored, and renders the router
 * stack. Route guards live in the group layouts.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useThemeContext } from '@/store/ThemeContext';
import { SessionProvider, useSession } from '@/store/SessionContext';
import { createQueryClient } from '@/services/queryClient';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = createQueryClient();

function RootNavigator() {
  const { status } = useSession();
  const { themeName, theme } = useThemeContext();

  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  return (
    <>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bgPage },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SessionProvider>
              <RootNavigator />
            </SessionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}