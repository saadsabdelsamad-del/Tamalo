import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nzvfgvodibvxgljkiqyk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmZndm9kaWJ2eGdsamtpcXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzMzMzksImV4cCI6MjA5MjEwOTMzOX0.YnDrEbgFyd7LyPSIfosReaVFaQZL0po_NksoymLOa_8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
