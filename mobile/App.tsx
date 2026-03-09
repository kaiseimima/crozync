import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import AuthScreen from './screens/AuthScreen'
import HomeScreen from './screens/HomeScreen'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null

  return (
    <>
      <StatusBar style="light" />
      {session ? <HomeScreen /> : <AuthScreen />}
    </>
  )
}
