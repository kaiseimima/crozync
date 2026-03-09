import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onBack: () => void
}

export default function SignUpScreen({ onBack }: Props) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>
          {mode === 'signup' ? 'Create My Identity' : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'signup' ? 'Start a new shared story' : 'Log in to your account'}
        </Text>

        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'signup' ? 'Create Account' : 'Log in'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null) }}>
            <Text style={styles.toggle}>
              {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 16,
    left: 24,
  },
  back: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.textPrimary,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  toggle: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
})
