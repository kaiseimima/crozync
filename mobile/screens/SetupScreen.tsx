import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onComplete: () => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

function formatTime(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default function SetupScreen({ onComplete }: Props) {
  const [wakeHour, setWakeHour] = useState(8)
  const [wakeMin, setWakeMin] = useState(0)
  const [sleepHour, setSleepHour] = useState(22)
  const [sleepMin, setSleepMin] = useState(0)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const wakeTime = formatTime(wakeHour, wakeMin)
      const sleepTime = formatTime(sleepHour, sleepMin)

      // Save to DB
      const { error } = await supabase
        .from('users')
        .update({
          wake_time: wakeTime,
          sleep_time: sleepTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        .eq('id', user.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      // Request notification permission & schedule
      await setupNotifications(wakeHour, wakeMin, sleepHour, sleepMin)

      onComplete()
    } finally {
      setSaving(false)
    }
  }

  async function setupNotifications(wH: number, wM: number, sH: number, sM: number) {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Notifications', 'Enable notifications in Settings to get reminders')
      return
    }

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })

    // Cancel existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync()

    // Schedule morning notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '☀️ Good Morning!',
        body: 'Send a heart to your partner',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: wH,
        minute: wM,
      },
    })

    // Schedule night notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 Good Night!',
        body: 'Send a heart before you sleep',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: sH,
        minute: sM,
      },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CROZYNC</Text>
      </View>

      <View style={styles.main}>
        <Text style={styles.title}>Set your schedule</Text>
        <Text style={styles.subtitle}>
          We'll remind you to send hearts at these times
        </Text>

        {/* Wake time */}
        <View style={styles.timeBlock}>
          <Text style={styles.timeBlockLabel}>☀️  Wake up</Text>
          <View style={styles.pickerRow}>
            {/* Hour */}
            <View style={styles.pickerColumn}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setWakeHour((h) => (h + 1) % 24)}
              >
                <Text style={styles.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.pickerValue}>{wakeHour.toString().padStart(2, '0')}</Text>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setWakeHour((h) => (h - 1 + 24) % 24)}
              >
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.colon}>:</Text>

            {/* Minute */}
            <View style={styles.pickerColumn}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => {
                  const idx = MINUTES.indexOf(wakeMin)
                  setWakeMin(MINUTES[(idx + 1) % MINUTES.length])
                }}
              >
                <Text style={styles.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.pickerValue}>{wakeMin.toString().padStart(2, '0')}</Text>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => {
                  const idx = MINUTES.indexOf(wakeMin)
                  setWakeMin(MINUTES[(idx - 1 + MINUTES.length) % MINUTES.length])
                }}
              >
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Sleep time */}
        <View style={styles.timeBlock}>
          <Text style={styles.timeBlockLabel}>🌙  Sleep</Text>
          <View style={styles.pickerRow}>
            {/* Hour */}
            <View style={styles.pickerColumn}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setSleepHour((h) => (h + 1) % 24)}
              >
                <Text style={styles.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.pickerValue}>{sleepHour.toString().padStart(2, '0')}</Text>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setSleepHour((h) => (h - 1 + 24) % 24)}
              >
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.colon}>:</Text>

            {/* Minute */}
            <View style={styles.pickerColumn}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => {
                  const idx = MINUTES.indexOf(sleepMin)
                  setSleepMin(MINUTES[(idx + 1) % MINUTES.length])
                }}
              >
                <Text style={styles.arrow}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.pickerValue}>{sleepMin.toString().padStart(2, '0')}</Text>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => {
                  const idx = MINUTES.indexOf(sleepMin)
                  setSleepMin(MINUTES[(idx - 1 + MINUTES.length) % MINUTES.length])
                }}
              >
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Start Crozync'}</Text>
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
    gap: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  // Time blocks
  timeBlock: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  timeBlockLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerColumn: {
    alignItems: 'center',
    gap: 4,
  },
  arrowButton: {
    padding: 8,
  },
  arrow: {
    fontSize: 16,
    color: colors.accent,
  },
  pickerValue: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    width: 64,
    textAlign: 'center',
  },
  colon: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  // Save
  saveButton: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
})
