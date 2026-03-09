import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Crozync</Text>
      <Text style={styles.sub}>Home — coming soon</Text>
      <TouchableOpacity style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.accent,
  },
  sub: {
    color: colors.textSecondary,
  },
  logout: {
    marginTop: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  logoutText: {
    color: colors.textSecondary,
  },
})
