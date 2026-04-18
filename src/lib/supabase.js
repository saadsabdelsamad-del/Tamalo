import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nzvfgvodibvxgljkiqyk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_RJtt0Zr5et0Y9vkXBZZ2Ug_BCAotafj'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
