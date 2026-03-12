import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onBack: () => void
  onPaired: () => void
}

export default function ScanScreen({ onBack, onPaired }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || processing) return
    setScanned(true)

    // Extract code from deep link or use raw value
    let code = data
    const match = data.match(/crozync:\/\/pair\/(.+)/)
    if (match) {
      code = match[1]
    }

    await acceptInvite(code)
  }

  async function acceptInvite(code: string) {
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        Alert.alert('Error', 'Not logged in')
        return
      }

      // Find the invite
      const { data: invite, error: findError } = await supabase
        .from('pair_invites')
        .select('id, created_by_user_id, expires_at, accepted_at')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle()

      if (findError || !invite) {
        Alert.alert('Invalid Code', 'This invite code was not found.')
        setScanned(false)
        setProcessing(false)
        return
      }

      if (invite.accepted_at) {
        Alert.alert('Already Used', 'This invite has already been accepted.')
        setScanned(false)
        setProcessing(false)
        return
      }

      if (new Date(invite.expires_at) < new Date()) {
        Alert.alert('Expired', 'This invite has expired. Ask your partner to create a new one.')
        setScanned(false)
        setProcessing(false)
        return
      }

      if (invite.created_by_user_id === user.id) {
        Alert.alert('Oops', "You can't pair with yourself!")
        setScanned(false)
        setProcessing(false)
        return
      }

      // Create the pair
      const { error: pairError } = await supabase
        .from('pairs')
        .insert({
          user_1_id: invite.created_by_user_id,
          user_2_id: user.id,
          next_turn_user_id: user.id,
        })

      if (pairError) {
        Alert.alert('Error', pairError.message)
        setScanned(false)
        setProcessing(false)
        return
      }

      // Mark invite as accepted
      await supabase
        .from('pair_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id)

      onPaired()
    } catch (e) {
      Alert.alert('Error', 'Something went wrong')
      setScanned(false)
    } finally {
      setProcessing(false)
    }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan your partner's QR code
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowManual(true)}>
            <Text style={styles.manualLink}>Enter code manually</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={onBack}>
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={{ width: 32 }} />
      </View>

      {showManual ? (
        /* Manual code entry */
        <View style={styles.manualContainer}>
          <Text style={styles.manualTitle}>Enter Invite Code</Text>
          <TextInput
            style={styles.codeInput}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="ABCD1234"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.submitButton, (!manualCode || processing) && styles.submitDisabled]}
            onPress={() => acceptInvite(manualCode)}
            disabled={!manualCode || processing}
          >
            {processing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Connect</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowManual(false)}>
            <Text style={styles.manualLink}>Use camera instead</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Camera scanner */
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            {/* Scan overlay */}
            <View style={styles.overlay}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
            </View>
          </CameraView>

          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.processingText}>Connecting...</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      {!showManual && (
        <View style={styles.footer}>
          <Text style={styles.hint}>Point your camera at your partner's QR code</Text>
          <TouchableOpacity onPress={() => setShowManual(true)}>
            <Text style={styles.manualLink}>Enter code manually</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backArrow: {
    fontSize: 24,
    color: colors.textPrimary,
    width: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Camera
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34, 22, 16, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Permission
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  permissionText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  grantButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  grantButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backLink: {
    marginTop: 8,
  },
  backText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Manual entry
  manualContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  manualTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  codeInput: {
    width: '100%',
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingVertical: 16,
  },
  submitButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualLink: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 8,
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
