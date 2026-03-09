import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LandingScreen from './screens/LandingScreen'
import SignUpScreen from './screens/SignUpScreen'
import HomeScreen from './screens/HomeScreen'

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
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={darkTheme}>
        {session ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
          </Stack.Navigator>
        ) : (
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
