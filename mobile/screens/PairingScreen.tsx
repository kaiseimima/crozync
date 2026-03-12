import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onScanQR: () => void
  onPaired: () => void
}

export default function PairingScreen({ onScanQR, onPaired }: Props) {
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createOrFetchInvite()
  }, [])

  // Poll for pairing status every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: pair } = await supabase
        .from('pairs')
        .select('id')
        .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle()

      if (pair) {
        clearInterval(interval)
        onPaired()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [onPaired])

  async function createOrFetchInvite() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check for existing valid invite
      const { data: existing } = await supabase
        .from('pair_invites')
        .select('code, expires_at')
        .eq('created_by_user_id', user.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        setInviteCode(existing.code)
        setLoading(false)
        return
      }

      // Create new invite
      const code = generateCode()
      const { error } = await supabase
        .from('pair_invites')
        .insert({ created_by_user_id: user.id, code })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setInviteCode(code)
    } catch (e) {
      Alert.alert('Error', 'Failed to create invite')
    } finally {
      setLoading(false)
    }
  }

  function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CROZYNC</Text>
      </View>

      {/* QR Code */}
      <View style={styles.main}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : inviteCode ? (
          <View style={styles.qrWrapper}>
            {/* Neon frame */}
            <View style={styles.qrFrame}>
              <View style={styles.qrBackground}>
                <QRCode
                  value={`crozync://pair/${inviteCode}`}
                  size={220}
                  backgroundColor="#FFFFFF"
                  color="#1a1a1a"
                />
              </View>
            </View>

            {/* Invite code text */}
            <Text style={styles.codeLabel}>Invite Code</Text>
            <TouchableOpacity
              style={styles.codeRow}
              onPress={async () => {
                await Clipboard.setStringAsync(inviteCode!)
                Alert.alert('Copied!', 'Invite code copied to clipboard')
              }}
            >
              <Text style={styles.codeText}>{inviteCode}</Text>
              <Text style={styles.copyIcon}>📋</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.instructions}>
          Share this code with your partner to sync your worlds
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.scanButton} onPress={onScanQR}>
          <Text style={styles.scanIcon}>📷</Text>
          <Text style={styles.scanText}>Scan QR Code</Text>
        </TouchableOpacity>

        <View style={styles.handle} />

        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.accent,
    letterSpacing: 6,
    opacity: 0.6,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  qrWrapper: {
    alignItems: 'center',
  },
  qrFrame: {
    padding: 3,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: 'rgba(236, 91, 19, 0.5)',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 15,
  },
  qrBackground: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 24,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  copyIcon: {
    fontSize: 22,
  },
  instructions: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 22,
    maxWidth: 200,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
    gap: 24,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: 'rgba(236, 91, 19, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(236, 91, 19, 0.3)',
    borderRadius: 12,
  },
  scanIcon: {
    fontSize: 20,
  },
  scanText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 1,
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    opacity: 0.5,
  },
  logoutText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
})
