import { useEffect, useState, useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LandingScreen from './screens/LandingScreen'
import SignUpScreen from './screens/SignUpScreen'
import PairingScreen from './screens/PairingScreen'
import ScanScreen from './screens/ScanScreen'
import SetupScreen from './screens/SetupScreen'
import HomeScreen from './screens/HomeScreen'
import FeedScreen from './screens/FeedScreen'
import CaptureScreen from './screens/CaptureScreen'
import SessionScreen from './screens/SessionScreen'
import SettingsScreen from './screens/SettingsScreen'

const Stack = createNativeStackNavigator()

const darkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#221610',
  },
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasPair, setHasPair] = useState(false)
  const [hasSetup, setHasSetup] = useState(false)
  const [pairChecked, setPairChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setHasPair(false)
        setHasSetup(false)
        setPairChecked(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check if user has a pair and has completed setup
  useEffect(() => {
    if (!session) {
      setPairChecked(false)
      return
    }

    checkStatus()
  }, [session])

  async function checkStatus() {
    const userId = session?.user?.id
    if (!userId) return

    // Check pair
    const { data: pair } = await supabase
      .from('pairs')
      .select('id')
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .limit(1)
      .maybeSingle()

    setHasPair(!!pair)

    // Check if user has set their timezone (indicates setup complete)
    if (pair) {
      const { data: user } = await supabase
        .from('users')
        .select('timezone')
        .eq('id', userId)
        .single()

      setHasSetup(!!user && user.timezone !== 'UTC')
    }

    setPairChecked(true)
  }

  const handlePaired = useCallback(() => {
    setHasPair(true)
  }, [])

  const handleSetupComplete = useCallback(() => {
    setHasSetup(true)
  }, [])

  if (loading) return null
  if (session && !pairChecked) return null

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={darkTheme}>
        {session ? (
          hasPair ? (
            hasSetup ? (
              /* Paired & setup done — show main app */
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home">
                  {({ navigation }) => (
                    <HomeScreen
                      onOpenFeed={() => navigation.navigate('Feed')}
                      onStartSession={() => navigation.navigate('Session')}
                      onOpenSettings={() => navigation.navigate('Settings')}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Session">
                  {({ navigation }) => (
                    <SessionScreen
                      onClose={() => navigation.navigate('Home')}
                      onCapture={() => navigation.navigate('SessionCapture')}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Settings">
                  {({ navigation }) => (
                    <SettingsScreen onBack={() => navigation.goBack()} />
                  )}
                </Stack.Screen>
                <Stack.Screen name="SessionCapture">
                  {({ navigation }) => (
                    <CaptureScreen
                      onBack={() => navigation.goBack()}
                      onPosted={() => navigation.navigate('Session')}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Feed">
                  {({ navigation }) => (
                    <FeedScreen
                      onBack={() => navigation.goBack()}
                      onCapture={() => navigation.navigate('Capture')}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="Capture">
                  {({ navigation }) => (
                    <CaptureScreen
                      onBack={() => navigation.goBack()}
                      onPosted={() => navigation.navigate('Feed')}
                    />
                  )}
                </Stack.Screen>
              </Stack.Navigator>
            ) : (
              /* Paired but no setup — show setup */
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Setup">
                  {() => <SetupScreen onComplete={handleSetupComplete} />}
                </Stack.Screen>
              </Stack.Navigator>
            )
          ) : (
            /* Logged in but not paired — show pairing flow */
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Pairing">
                {({ navigation }) => (
                  <PairingScreen
                    onScanQR={() => navigation.navigate('Scan')}
                    onPaired={handlePaired}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Scan">
                {({ navigation }) => (
                  <ScanScreen
                    onBack={() => navigation.goBack()}
                    onPaired={handlePaired}
                  />
                )}
              </Stack.Screen>
            </Stack.Navigator>
          )
        ) : (
          /* Not logged in */
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Landing">
              {({ navigation }) => (
                <LandingScreen
                  onCreateIdentity={() => navigation.navigate('SignUp')}
                  onScanQR={() => navigation.navigate('SignUp')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="SignUp">
              {({ navigation }) => (
                <SignUpScreen onBack={() => navigation.goBack()} />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
