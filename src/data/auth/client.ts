import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { getSupabaseConfig } from '@/config/supabase';

let client: SupabaseClient | null | undefined;
let appStateConfigured = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = getSupabaseConfig();
  if (!config) return (client = null);
  client = createClient(config.url, config.publishableKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      experimental: {
        appendPkceFlowIdToRedirects: true,
      },
    },
  });
  if (Platform.OS !== 'web' && !appStateConfigured) {
    appStateConfigured = true;
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }
  return client;
}
