import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ljadftdhwbllfrlhhuoy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GX_tXoN6HHBHrNcvjGhRIw__j17Bqsx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);