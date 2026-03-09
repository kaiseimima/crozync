import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../constants/colors'

type Props = {
  onCreateIdentity: () => void
  onScanQR: () => void
}

export default function LandingScreen({ onCreateIdentity, onScanQR }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoIcon}>📖</Text>
          <Text style={styles.logoText}>Crozync</Text>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.photoFrame}>
          <View style={styles.photoInner}>
            <Text style={styles.photoPlaceholder}>📸</Text>
          </View>
        </View>
        <View style={styles.heartBadge}>
          <Text style={styles.heartIcon}>♥</Text>
        </View>
      </View>

      {/* Text */}
      <Text style={styles.title}>Begin your story</Text>
      <Text style={styles.subtitle}>
        Connect your worlds and sync your moments in a private digital diary.
      </Text>

      {/* CTA Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onScanQR}>
          <View style={styles.buttonIconWrap}>
            <Text style={styles.buttonIcon}>📱</Text>
          </View>
          <View style={styles.buttonTextWrap}>
            <Text style={styles.buttonTitle}>Scan Partner's QR</Text>
            <Text style={styles.buttonSub}>Join an existing diary</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onCreateIdentity}>
          <View style={styles.buttonIconWrapSec}>
            <Text style={styles.buttonIcon}>👤</Text>
          </View>
          <View style={styles.buttonTextWrap}>
            <Text style={styles.buttonTitle}>Create My Identity</Text>
            <Text style={styles.buttonSubSec}>Start a new shared story</Text>
          </View>
          <Text style={styles.plus}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <View style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navLabelActive}>ENTRY</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navIcon}>🖼</Text>
          <Text style={styles.navLabel}>MEMORIES</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>SETUP</Text>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    fontSize: 24,
    backgroundColor: colors.accentDim,
    padding: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
    height: 240,
  },
  photoFrame: {
    width: 180,
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    transform: [{ rotate: '3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  photoInner: {
    flex: 1,
    backgroundColor: '#E8E0DA',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    fontSize: 48,
  },
  heartBadge: {
    position: 'absolute',
    bottom: 10,
    right: 60,
    width: 72,
    height: 72,
    backgroundColor: colors.accent,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  heartIcon: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 48,
    marginBottom: 32,
    lineHeight: 22,
  },
  actions: {
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  buttonIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 12,
  },
  buttonIconWrapSec: {
    backgroundColor: colors.accentDim,
    padding: 12,
    borderRadius: 12,
  },
  buttonIcon: {
    fontSize: 24,
  },
  buttonTextWrap: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  buttonSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  buttonSubSec: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  arrow: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.5)',
  },
  plus: {
    fontSize: 20,
    color: colors.accent,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 'auto',
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navIconActive: {
    fontSize: 22,
  },
  navIcon: {
    fontSize: 22,
    opacity: 0.4,
  },
  navLabelActive: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 2,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
})
