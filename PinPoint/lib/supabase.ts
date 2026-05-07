import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rxmzlciusnnqsqukxpjt.supabase.co'
const supabaseAnonKey = 'sb_publishable_MHzvEcVL-rBbJcQg1ZCYBw_dZRqt8pV'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
