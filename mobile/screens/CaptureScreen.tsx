import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

type Props = {
  onBack: () => void
  onPosted: () => void
}

export default function CaptureScreen({ onBack, onPosted }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    })

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    })

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
    }
  }

  async function uploadAndPost() {
    if (!imageUri) return
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get pair
      const { data: pair } = await supabase
        .from('pairs')
        .select('id, next_turn_user_id')
        .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle()

      if (!pair) {
        Alert.alert('Error', 'No pair found')
        return
      }

      // Upload image to Supabase Storage
      const fileName = `${pair.id}/${user.id}_${Date.now()}.jpg`

      const response = await fetch(imageUri)
      const blob = await response.blob()

      // Convert blob to ArrayBuffer
      const arrayBuffer = await new Response(blob).arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('stickers')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadError) {
        Alert.alert('Upload Error', uploadError.message)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('stickers')
        .getPublicUrl(fileName)

      // Create sticker record
      const { error: insertError } = await supabase
        .from('stickers')
        .insert({
          pair_id: pair.id,
          user_id: user.id,
          image_url: urlData.publicUrl,
        })

      if (insertError) {
        Alert.alert('Error', insertError.message)
        return
      }

      // Toggle turn to partner
      const { data: pairFull } = await supabase
        .from('pairs')
        .select('user_1_id, user_2_id')
        .eq('id', pair.id)
        .single()

      if (pairFull) {
        const partnerId = pairFull.user_1_id === user.id
          ? pairFull.user_2_id
          : pairFull.user_1_id

        await supabase
          .from('pairs')
          .update({ next_turn_user_id: partnerId })
          .eq('id', pair.id)
      }

      onPosted()
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Sticker</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.main}>
        {imageUri ? (
          /* Preview */
          <View style={styles.previewContainer}>
            <View style={styles.stickerFrame}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            </View>

            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeButton} onPress={() => setImageUri(null)}>
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.postButton, uploading && styles.postDisabled]}
                onPress={uploadAndPost}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.postText}>Post Sticker</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Capture options */
          <View style={styles.captureOptions}>
            <Text style={styles.promptText}>Add a moment to your diary</Text>

            <TouchableOpacity style={styles.cameraButton} onPress={takePhoto} activeOpacity={0.8}>
              <Text style={styles.cameraEmoji}>📷</Text>
              <Text style={styles.cameraLabel}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.libraryButton} onPress={pickFromLibrary}>
              <Text style={styles.libraryEmoji}>🖼</Text>
              <Text style={styles.libraryLabel}>Choose from Library</Text>
            </TouchableOpacity>
          </View>
        )}
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
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  // Capture options
  captureOptions: {
    alignItems: 'center',
    gap: 20,
    width: '100%',
  },
  promptText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 16,
  },
  cameraButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cameraEmoji: {
    fontSize: 40,
  },
  cameraLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  libraryEmoji: {
    fontSize: 20,
  },
  libraryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Preview
  previewContainer: {
    alignItems: 'center',
    gap: 32,
  },
  stickerFrame: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    transform: [{ rotate: '-2deg' }],
  },
  previewImage: {
    width: 240,
    height: 320,
    borderRadius: 8,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 16,
  },
  retakeButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  retakeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  postButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  postDisabled: {
    opacity: 0.6,
  },
  postText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
