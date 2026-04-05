import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// აქ უნდა ჩასვა შენი Supabase პროექტის URL და anon key
const supabaseUrl = 'https://qclzhlftlkjhgmuqrawk.supabase.co';
const supabaseAnonKey = 'sb_publishable_uh0AkTmoH-tDL4epEywDKA_6Xxf-sF9';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});