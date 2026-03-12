import { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onOpenFeed?: () => void
  onStartSession?: () => void
  onOpenSettings?: () => void
}

type HeartInfo = {
  type: 'good_morning' | 'good_night'
  sent_at: string
  from_user_id: string
}

function getMoodType(): 'good_morning' | 'good_night' {
  const hour = new Date().getHours()
  return hour >= 5 && hour < 18 ? 'good_morning' : 'good_night'
}

function getMoodLabel(type: 'good_morning' | 'good_night'): string {
  return type === 'good_morning' ? 'MORNING MOOD' : 'NIGHT MOOD'
}

function getMoodMessage(type: 'good_morning' | 'good_night'): string {
  return type === 'good_morning' ? 'Good Morning!' : 'Good Night!'
}

export default function HomeScreen({ onOpenFeed, onStartSession, onOpenSettings }: Props = {}) {
  const [partnerTime, setPartnerTime] = useState('')
  const [partnerTimezone, setPartnerTimezone] = useState<string | null>(null)
  const [partnerLocation, setPartnerLocation] = useState('')
  const [pulseAnim] = useState(new Animated.Value(1))
  const [moodType, setMoodType] = useState(getMoodType())
  const [heartSentToday, setHeartSentToday] = useState(false)
  const [receivedHeart, setReceivedHeart] = useState<HeartInfo | null>(null)
  const [sendingHeart, setSendingHeart] = useState(false)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const heartBounce = useRef(new Animated.Value(1)).current
  const heartFade = useRef(new Animated.Value(0)).current

  // Load partner timezone and update time
  useEffect(() => {
    loadPartnerTimezone()
  }, [])

  useEffect(() => {
    if (!partnerTimezone) return

    function updateTime() {
      const now = new Date()
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: partnerTimezone!,
      }).format(now)
      setPartnerTime(timeStr)
      setMoodType(getMoodType())
    }
    updateTime()
    const interval = setInterval(updateTime, 30000)
    return () => clearInterval(interval)
  }, [partnerTimezone])

  async function loadPartnerTimezone() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: pair } = await supabase
      .from('pairs')
      .select('user_1_id, user_2_id')
      .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle()

    if (!pair) return

    const partId = pair.user_1_id === user.id ? pair.user_2_id : pair.user_1_id

    const { data: partner } = await supabase
      .from('users')
      .select('timezone')
      .eq('id', partId)
      .single()

    const tz = partner?.timezone || 'UTC'
    setPartnerTimezone(tz)

    // Format timezone to readable location (e.g. "Asia/Tokyo" → "Tokyo")
    const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz
    setPartnerLocation(city)
  }

  useEffect(() => {
    loadHeartData()
  }, [])

  // Pulse animation for CROZYNC button
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulseAnim])

  async function loadHeartData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // Get partner ID
    const { data: pair } = await supabase
      .from('pairs')
      .select('user_1_id, user_2_id')
      .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle()

    if (!pair) return

    const partner = pair.user_1_id === user.id ? pair.user_2_id : pair.user_1_id
    setPartnerId(partner)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Check if I already sent a heart today
    const { data: sentHeart } = await supabase
      .from('hearts')
      .select('id')
      .eq('from_user_id', user.id)
      .gte('sent_at', todayStart.toISOString())
      .limit(1)
      .maybeSingle()

    setHeartSentToday(!!sentHeart)

    // Check if partner sent me a heart today
    const { data: received } = await supabase
      .from('hearts')
      .select('type, sent_at, from_user_id')
      .eq('from_user_id', partner)
      .eq('to_user_id', user.id)
      .gte('sent_at', todayStart.toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (received) {
      setReceivedHeart(received as HeartInfo)
    }
  }

  async function sendHeart() {
    if (!partnerId || !userId || heartSentToday || sendingHeart) return
    setSendingHeart(true)

    try {
      const { error } = await supabase
        .from('hearts')
        .insert({
          from_user_id: userId,
          to_user_id: partnerId,
          type: moodType,
        })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setHeartSentToday(true)

      // Bounce animation
      Animated.sequence([
        Animated.timing(heartBounce, { toValue: 1.4, duration: 200, useNativeDriver: true }),
        Animated.timing(heartBounce, { toValue: 0.9, duration: 150, useNativeDriver: true }),
        Animated.timing(heartBounce, { toValue: 1.1, duration: 100, useNativeDriver: true }),
        Animated.timing(heartBounce, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start()

      // Show floating heart
      heartFade.setValue(1)
      Animated.timing(heartFade, { toValue: 0, duration: 2000, useNativeDriver: true }).start()
    } finally {
      setSendingHeart(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating heart animation */}
      <Animated.View
        style={[styles.floatingHeart, { opacity: heartFade, transform: [{ translateY: heartFade.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] }]}
        pointerEvents="none"
      >
        <Text style={styles.floatingHeartText}>♥</Text>
      </Animated.View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoBox} onPress={onOpenSettings}>
          <Text style={styles.logoLetter}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.feedButton} onPress={onOpenFeed}>
          <Text style={styles.feedIcon}>🖼</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.main}>
        {/* Partner Time */}
        <View style={styles.timeSection}>
          <Text style={styles.timeLabel}>PARTNER'S TIME</Text>
          <Text style={styles.timeDisplay}>{partnerTime}</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationDot} />
            <Text style={styles.locationText}>{partnerLocation || '...'}</Text>
          </View>
        </View>

        {/* CROZYNC Button */}
        <Animated.View style={[styles.syncButtonOuter, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={styles.syncButton} activeOpacity={0.85} onPress={onStartSession}>
            <View style={styles.syncIconWrap}>
              <Text style={styles.syncCameraIcon}>📷</Text>
            </View>
            <Text style={styles.syncLabel}>CROZYNC</Text>
          </TouchableOpacity>
          {/* Decorative sticker */}
          <View style={styles.sparkleSticker}>
            <Text style={{ fontSize: 16 }}>✨</Text>
          </View>
        </Animated.View>

        {/* Heart / Mood Panel */}
        <View style={styles.statusPanel}>
          <View>
            <Text style={styles.statusLabel}>{getMoodLabel(moodType)}</Text>
            {receivedHeart ? (
              <Text style={styles.statusMessage}>
                {receivedHeart.type === 'good_morning' ? '☀️' : '🌙'} Partner sent a heart!
              </Text>
            ) : (
              <Text style={styles.statusMessage}>{getMoodMessage(moodType)}</Text>
            )}
          </View>

          <Animated.View style={{ transform: [{ scale: heartBounce }] }}>
            <TouchableOpacity
              style={[
                styles.heartButton,
                heartSentToday && styles.heartButtonSent,
              ]}
              onPress={sendHeart}
              disabled={heartSentToday || sendingHeart}
              activeOpacity={0.7}
            >
              <Text style={[styles.heartIcon, heartSentToday && styles.heartIconSent]}>
                {heartSentToday ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {heartSentToday && (
          <Text style={styles.heartSentHint}>Heart sent today</Text>
        )}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>STAY SYNCED • STAY CLOSE</Text>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 142, 57, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#ef8e39',
    fontWeight: '800',
    fontSize: 20,
  },
  feedButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedIcon: {
    fontSize: 24,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: 24,
  },
  timeSection: {
    alignItems: 'center',
  },
  timeLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 3,
    marginBottom: 4,
  },
  timeDisplay: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: -2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef8e39',
  },
  locationText: {
    color: '#ef8e39',
    fontWeight: '500',
    fontSize: 15,
  },
  syncButtonOuter: {
    position: 'relative',
  },
  syncButton: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: '#ef8e39',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef8e39',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  syncIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 16,
    borderRadius: 32,
    marginBottom: 8,
  },
  syncCameraIcon: {
    fontSize: 36,
  },
  syncLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 2,
  },
  sparkleSticker: {
    position: 'absolute',
    top: -16,
    right: -16,
    backgroundColor: '#1e1e1e',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '12deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statusPanel: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1e1e1e',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  statusMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  heartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 142, 57, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 142, 57, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef8e39',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 5,
  },
  heartButtonSent: {
    backgroundColor: 'rgba(239, 142, 57, 0.25)',
    borderColor: colors.accent,
  },
  heartIcon: {
    fontSize: 24,
    color: '#ef8e39',
  },
  heartIconSent: {
    color: colors.accent,
  },
  heartSentHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -16,
  },
  // Floating heart
  floatingHeart: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    zIndex: 100,
  },
  floatingHeartText: {
    fontSize: 64,
    color: colors.accent,
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 8,
  },
})
