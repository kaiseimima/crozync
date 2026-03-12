import { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

const SCREEN_WIDTH = Dimensions.get('window').width
const TIMER_SIZE = 224
const RING_RADIUS = 100
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const SESSION_DURATION = 180 // 3 minutes

type Props = {
  onClose: () => void
  onCapture: () => void
}

type SessionState = 'requesting' | 'waiting' | 'active' | 'expired' | 'completed'

export default function SessionScreen({ onClose, onCapture }: Props) {
  const [state, setState] = useState<SessionState>('requesting')
  const [timeLeft, setTimeLeft] = useState(SESSION_DURATION)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [partnerJoined, setPartnerJoined] = useState(false)
  const [myPhotoTaken, setMyPhotoTaken] = useState(false)
  const glowAnim = useRef(new Animated.Value(0.4)).current
  const partnerPulse = useRef(new Animated.Value(1)).current

  // Glow animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [glowAnim])

  // Partner waiting pulse
  useEffect(() => {
    if (partnerJoined) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(partnerPulse, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
        Animated.timing(partnerPulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [partnerJoined, partnerPulse])

  // Create session on mount
  useEffect(() => {
    createSession()
  }, [])

  // Countdown timer
  useEffect(() => {
    if (state !== 'waiting' && state !== 'active') return

    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval)
          setState('expired')
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  // Poll for partner's response
  useEffect(() => {
    if (!sessionId || state === 'expired' || state === 'completed') return

    const interval = setInterval(async () => {
      // Check if partner has taken a photo for this session
      const { data: partnerSticker } = await supabase
        .from('stickers')
        .select('id')
        .eq('crozync_session_id', sessionId)
        .neq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .limit(1)
        .maybeSingle()

      if (partnerSticker) {
        setPartnerJoined(true)
        if (myPhotoTaken) {
          setState('completed')
        } else {
          setState('active')
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [sessionId, state, myPhotoTaken])

  async function createSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get pair
      const { data: pair } = await supabase
        .from('pairs')
        .select('id')
        .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle()

      if (!pair) {
        Alert.alert('Error', 'No pair found')
        onClose()
        return
      }

      // Check for existing active session today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { data: existing } = await supabase
        .from('crozync_sessions')
        .select('id, status')
        .eq('pair_id', pair.id)
        .gte('requested_at', todayStart.toISOString())
        .in('status', ['pending', 'completed'])
        .limit(1)
        .maybeSingle()

      if (existing?.status === 'completed') {
        Alert.alert('Already Done', "You've already had a Crozync session today!")
        onClose()
        return
      }

      if (existing?.status === 'pending') {
        // Resume existing session
        setSessionId(existing.id)
        setState('waiting')
        return
      }

      // Create new session
      const { data: session, error } = await supabase
        .from('crozync_sessions')
        .insert({
          pair_id: pair.id,
          requested_by_user_id: user.id,
        })
        .select('id')
        .single()

      if (error) {
        Alert.alert('Error', error.message)
        onClose()
        return
      }

      setSessionId(session.id)
      setState('waiting')
    } catch (e) {
      Alert.alert('Error', 'Failed to create session')
      onClose()
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const progress = timeLeft / SESSION_DURATION
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoPlus}>+</Text>
          </View>
          <Text style={styles.headerTitle}>Crozync</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View style={styles.main}>
        {/* Timer circle */}
        <View style={styles.timerContainer}>
          {/* Glow */}
          <Animated.View style={[styles.timerGlow, { opacity: glowAnim }]} />

          {/* SVG-like ring using views */}
          <View style={styles.timerRing}>
            {/* Background ring */}
            <View style={styles.ringBg} />
            {/* Timer text */}
            <View style={styles.timerTextContainer}>
              <Text style={[
                styles.timerText,
                state === 'expired' && styles.timerExpired,
              ]}>
                {formatTime(timeLeft)}
              </Text>
              <Text style={styles.timerLabel}>
                {state === 'requesting' ? 'STARTING...' :
                 state === 'expired' ? 'TIME\'S UP' :
                 state === 'completed' ? 'DONE!' :
                 'REMAINING'}
              </Text>
            </View>
          </View>
        </View>

        {/* Partner status */}
        <View style={styles.statusGrid}>
          {/* My slot */}
          <View style={styles.statusSlot}>
            <View style={[styles.statusCard, styles.statusCardActive]}>
              {myPhotoTaken ? (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              ) : (
                <Text style={styles.statusEmoji}>📷</Text>
              )}
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            </View>
            <Text style={styles.statusLabel}>
              {myPhotoTaken ? 'Done!' : 'Ready'}
            </Text>
          </View>

          {/* Partner slot */}
          <View style={styles.statusSlot}>
            <Animated.View style={[
              styles.statusCard,
              partnerJoined ? styles.statusCardJoined : styles.statusCardWaiting,
              !partnerJoined && { opacity: partnerPulse },
            ]}>
              {partnerJoined ? (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              ) : (
                <Text style={styles.statusEmoji}>👤</Text>
              )}
            </Animated.View>
            <Text style={[
              styles.statusLabel,
              partnerJoined && styles.statusLabelJoined,
            ]}>
              {partnerJoined ? 'Partner joined!' : 'Waiting for partner...'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {state === 'expired' ? (
          <TouchableOpacity style={styles.closeSessionButton} onPress={onClose}>
            <Text style={styles.closeSessionText}>Close</Text>
          </TouchableOpacity>
        ) : state === 'completed' ? (
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneText}>View Feed</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Cancel */}
            <TouchableOpacity style={styles.sideButton} onPress={onClose}>
              <Text style={styles.sideButtonIcon}>✕</Text>
            </TouchableOpacity>

            {/* Capture button */}
            <TouchableOpacity
              style={[styles.captureButton, myPhotoTaken && styles.captureDisabled]}
              onPress={() => {
                if (!myPhotoTaken) {
                  setMyPhotoTaken(true)
                  onCapture()
                }
              }}
              disabled={myPhotoTaken}
              activeOpacity={0.8}
            >
              <View style={styles.captureInner}>
                {myPhotoTaken ? (
                  <Text style={styles.capturedCheck}>✓</Text>
                ) : (
                  <View style={styles.captureStop} />
                )}
              </View>
            </TouchableOpacity>

            {/* Placeholder for symmetry */}
            <View style={styles.sideButton}>
              <Text style={styles.sideButtonIcon}>🔄</Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlus: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f1115',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1d23',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: '#9ca3af',
  },
  // Main
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    paddingHorizontal: 32,
  },
  // Timer
  timerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: TIMER_SIZE,
    height: TIMER_SIZE,
  },
  timerGlow: {
    position: 'absolute',
    width: TIMER_SIZE - 32,
    height: TIMER_SIZE - 32,
    borderRadius: (TIMER_SIZE - 32) / 2,
    backgroundColor: colors.accent,
  },
  timerRing: {
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    borderRadius: TIMER_SIZE / 2,
    borderWidth: 6,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1115',
  },
  ringBg: {
    position: 'absolute',
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    borderRadius: TIMER_SIZE / 2,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timerTextContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -2,
    textShadowColor: 'rgba(239, 142, 57, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  timerExpired: {
    color: '#EF4444',
    textShadowColor: 'rgba(239, 68, 68, 0.6)',
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(239, 142, 57, 0.8)',
    letterSpacing: 4,
    marginTop: 4,
  },
  // Status grid
  statusGrid: {
    flexDirection: 'row',
    gap: 24,
    width: '100%',
    justifyContent: 'center',
  },
  statusSlot: {
    alignItems: 'center',
    gap: 10,
  },
  statusCard: {
    width: 120,
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardActive: {
    backgroundColor: '#1a1d23',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 5,
  },
  statusCardWaiting: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statusCardJoined: {
    backgroundColor: 'rgba(239, 142, 57, 0.15)',
    borderWidth: 3,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 5,
  },
  statusEmoji: {
    fontSize: 32,
    opacity: 0.5,
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  checkMark: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.accent,
  },
  youBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0f1115',
    letterSpacing: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  statusLabelJoined: {
    color: colors.accent,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 48,
    paddingHorizontal: 32,
    gap: 24,
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(26, 29, 35, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonIcon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    padding: 4,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  captureDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    flex: 1,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(15, 17, 21, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureStop: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#0f1115',
  },
  capturedCheck: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f1115',
  },
  closeSessionButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: '#1a1d23',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeSessionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
