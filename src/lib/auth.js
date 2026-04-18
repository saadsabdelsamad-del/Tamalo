import { supabase } from './supabase'

async function hashPin(pin) {
  const data = new TextEncoder().encode(pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function loginOrRegister(name, pin) {
  const nameLower = name.trim().toLowerCase()
  const pinHash = await hashPin(pin)

  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('name_lower', nameLower)
    .single()

  if (existing) {
    if (existing.pin_hash !== pinHash) throw new Error('Wrong PIN')
    return existing
  }

  const { data: created, error } = await supabase
    .from('players')
    .insert({ name: name.trim(), name_lower: nameLower, pin_hash: pinHash })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created
}
