import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [sessionChecked, setSessionChecked] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const inAuthGroup = segments[0] === '(auth)';
      
      if (!session && !inAuthGroup) {
        router.replace('/(auth)/sign-in');
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)');
      }
      setSessionChecked(true);
    };
    
    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const inAuthGroup = segments[0] === '(auth)';
      if (!session && !inAuthGroup) {
        router.replace('/(auth)/sign-in');
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [segments]);

  if (!sessionChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#EAF4F4', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8A7DFF" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
