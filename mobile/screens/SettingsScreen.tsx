import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onBack: () => void
}

function createTimeDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

function formatTime(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default function SettingsScreen({ onBack }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [wakeTime, setWakeTime] = useState(createTimeDate('08:00'))
  const [sleepTime, setSleepTime] = useState(createTimeDate('22:00'))
  const [timezone, setTimezone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('users')
      .select('display_name, wake_time, sleep_time, timezone')
      .eq('id', user.id)
      .single()

    if (data) {
      setDisplayName(data.display_name)
      setWakeTime(createTimeDate(data.wake_time))
      setSleepTime(createTimeDate(data.sleep_time))
      setTimezone(data.timezone)
    }
    setLoading(false)
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

      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName.trim(),
          wake_time: formatTime(wH, wM),
          sleep_time: formatTime(sH, sM),
        })
        .eq('id', user.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      // Reschedule notifications
      await rescheduleNotifications(wH, wM, sH, sM)

      Alert.alert('Saved', 'Settings updated!')
      onBack()
    } finally {
      setSaving(false)
    }
  }

  async function rescheduleNotifications(wH: number, wM: number, sH: number, sM: number) {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return

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

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await Notifications.cancelAllScheduledNotificationsAsync()
          await supabase.auth.signOut()
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} style={{ flex: 1 }} />
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <Text style={styles.sectionTitle}>PROFILE</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Timezone</Text>
          <Text style={styles.valueText}>{timezone}</Text>
        </View>

        {/* Schedule */}
        <Text style={styles.sectionTitle}>SCHEDULE</Text>
        <View style={styles.card}>
          <Text style={styles.label}>☀️  Wake up</Text>
          <DateTimePicker
            value={wakeTime}
            mode="time"
            display="spinner"
            onChange={(_e: DateTimePickerEvent, d?: Date) => d && setWakeTime(d)}
            minuteInterval={5}
            themeVariant="dark"
            style={styles.picker}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>🌙  Sleep</Text>
          <DateTimePicker
            value={sleepTime}
            mode="time"
            display="spinner"
            onChange={(_e: DateTimePickerEvent, d?: Date) => d && setSleepTime(d)}
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
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 3,
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  valueText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  picker: {
    height: 120,
    width: '100%',
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },
  logoutText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '600',
  },
})
