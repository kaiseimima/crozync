import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onComplete: () => void
}

function createTimeDate(h: number, m: number): Date {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

function formatTime(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default function SetupScreen({ onComplete }: Props) {
  const [wakeTime, setWakeTime] = useState(createTimeDate(8, 0))
  const [sleepTime, setSleepTime] = useState(createTimeDate(22, 0))
  const [saving, setSaving] = useState(false)

  function onWakeChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) setWakeTime(date)
  }

  function onSleepChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) setSleepTime(date)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const wH = wakeTime.getHours()
      const wM = wakeTime.getMinutes()
      const sH = sleepTime.getHours()
      const sM = sleepTime.getMinutes()

      // Save to DB
      const { error } = await supabase
        .from('users')
        .update({
          wake_time: formatTime(wH, wM),
          sleep_time: formatTime(sH, sM),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        .eq('id', user.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      // Request notification permission & schedule
      await setupNotifications(wH, wM, sH, sM)

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

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })

    await Notifications.cancelAllScheduledNotificationsAsync()

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
          <DateTimePicker
            value={wakeTime}
            mode="time"
            display="spinner"
            onChange={onWakeChange}
            minuteInterval={5}
            themeVariant="dark"
            style={styles.picker}
          />
        </View>

        {/* Sleep time */}
        <View style={styles.timeBlock}>
          <Text style={styles.timeBlockLabel}>🌙  Sleep</Text>
          <DateTimePicker
            value={sleepTime}
            mode="time"
            display="spinner"
            onChange={onSleepChange}
            minuteInterval={5}
            themeVariant="dark"
            style={styles.picker}
          />
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
  timeBlock: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  timeBlockLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  picker: {
    height: 120,
    width: '100%',
  },
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
