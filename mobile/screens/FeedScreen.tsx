import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const STICKER_WIDTH = SCREEN_WIDTH * 0.36
const STICKER_HEIGHT = STICKER_WIDTH * 1.35

type Sticker = {
  id: string
  user_id: string
  image_url: string
  is_crozync: boolean
  created_at: string
}

type StickerPair = {
  date: string
  mine: Sticker | null
  partner: Sticker | null
}

type Props = {
  onBack: () => void
  onCapture?: () => void
}

export default function FeedScreen({ onBack, onCapture }: Props) {
  const [stickerPairs, setStickerPairs] = useState<StickerPair[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isMyTurn, setIsMyTurn] = useState(false)

  useEffect(() => {
    loadFeed()
  }, [])

  async function loadFeed() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Get user's pair
      const { data: pair } = await supabase
        .from('pairs')
        .select('id, user_1_id, user_2_id, next_turn_user_id')
        .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle()

      if (!pair) return

      setIsMyTurn(pair.next_turn_user_id === user.id)

      // Get all stickers for this pair
      const { data: stickers } = await supabase
        .from('stickers')
        .select('id, user_id, image_url, is_crozync, created_at')
        .eq('pair_id', pair.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (!stickers) return

      // Group stickers by date into pairs
      const grouped = groupStickersByDate(stickers, user.id)
      setStickerPairs(grouped)
    } catch (e) {
      console.error('Failed to load feed:', e)
    } finally {
      setLoading(false)
    }
  }

  function groupStickersByDate(stickers: Sticker[], myUserId: string): StickerPair[] {
    const dateMap = new Map<string, { mine: Sticker | null; partner: Sticker | null }>()

    for (const sticker of stickers) {
      const date = sticker.created_at.split('T')[0]
      if (!dateMap.has(date)) {
        dateMap.set(date, { mine: null, partner: null })
      }
      const entry = dateMap.get(date)!
      if (sticker.user_id === myUserId) {
        entry.mine = sticker
      } else {
        entry.partner = sticker
      }
    }

    return Array.from(dateMap.entries())
      .map(([date, pair]) => ({ date, ...pair }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (dateStr === today.toISOString().split('T')[0]) return 'Today'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday'

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Randomize sticker rotations for natural feel
  const rotations = [-3, 2, -1, 4, -2, 3, -4, 1]

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.logoBadge}>
          <View style={styles.logoInner} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current turn slot */}
          <View style={styles.currentTurnSection}>
            <View style={styles.stickerPairRow}>
              {/* My slot */}
              {isMyTurn ? (
                <TouchableOpacity
                  style={[styles.stickerSlotActive, styles.stickerLeft]}
                  onPress={onCapture}
                  activeOpacity={0.8}
                >
                  <View style={styles.spinnerContainer}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                  <View style={styles.cameraIconWrap}>
                    <Text style={styles.cameraIcon}>📷</Text>
                  </View>
                  <Text style={styles.yourTurnText}>Your turn</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.stickerSlotWaiting, styles.stickerLeft]}>
                  <Text style={styles.waitingIcon}>⏳</Text>
                  <Text style={styles.waitingText}>Waiting...</Text>
                </View>
              )}

              {/* Partner's slot */}
              <View style={[styles.stickerSlotLocked, styles.stickerRight]}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            </View>
          </View>

          {/* History */}
          {stickerPairs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={styles.emptyTitle}>Your story starts here</Text>
              <Text style={styles.emptySubtitle}>
                Take your first photo to add a sticker to your shared diary
              </Text>
            </View>
          ) : (
            <View style={styles.historyContainer}>
              {stickerPairs.map((pair, index) => (
                <View key={pair.date}>
                  {/* Date label */}
                  <Text style={styles.dateLabel}>{formatDate(pair.date)}</Text>

                  {/* Sticker pair */}
                  <View
                    style={[
                      styles.stickerPairRow,
                      { transform: [{ translateX: (index % 3 - 1) * 8 }] },
                    ]}
                  >
                    {/* My sticker */}
                    {pair.mine ? (
                      <View
                        style={[
                          styles.sticker,
                          styles.stickerLeft,
                          { transform: [{ rotate: `${rotations[index % rotations.length]}deg` }] },
                        ]}
                      >
                        <Image
                          source={{ uri: pair.mine.image_url }}
                          style={styles.stickerImage}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View style={[styles.stickerEmpty, styles.stickerLeft]} />
                    )}

                    {/* Partner sticker */}
                    {pair.partner ? (
                      <View
                        style={[
                          styles.sticker,
                          styles.stickerRight,
                          { transform: [{ rotate: `${rotations[(index + 3) % rotations.length]}deg` }] },
                        ]}
                      >
                        <Image
                          source={{ uri: pair.partner.image_url }}
                          style={styles.stickerImage}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View style={[styles.stickerEmpty, styles.stickerRight]} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Floating capture button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={onCapture} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>📷</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  // Current turn
  currentTurnSection: {
    marginBottom: 40,
    paddingTop: 16,
  },
  stickerPairRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerSlotActive: {
    width: STICKER_WIDTH,
    height: STICKER_HEIGHT,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'rgba(236, 91, 19, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    padding: 4,
  },
  spinnerContainer: {
    marginBottom: 4,
  },
  cameraIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(236, 91, 19, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 18,
  },
  yourTurnText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    letterSpacing: 1,
  },
  stickerSlotWaiting: {
    width: STICKER_WIDTH,
    height: STICKER_HEIGHT,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 4,
  },
  waitingIcon: {
    fontSize: 20,
  },
  waitingText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  stickerSlotLocked: {
    width: STICKER_WIDTH,
    height: STICKER_HEIGHT,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#444',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  lockIcon: {
    fontSize: 24,
    opacity: 0.5,
  },
  // Stickers
  stickerLeft: {
    zIndex: 10,
  },
  stickerRight: {
    marginLeft: -15,
    zIndex: 5,
  },
  sticker: {
    width: STICKER_WIDTH - 8,
    height: STICKER_HEIGHT - 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  stickerEmpty: {
    width: STICKER_WIDTH - 8,
    height: STICKER_HEIGHT - 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#333',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  // Date labels
  dateLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  // History
  historyContainer: {
    gap: 32,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: {
    fontSize: 28,
  },
})
