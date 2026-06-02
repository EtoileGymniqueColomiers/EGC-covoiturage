import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMessages, useSendMessage } from '@/hooks/useMessages'
import { useAuthStore } from '@/stores/auth.store'
import { MessageBubble } from '@/components/MessageBubble'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const { profile } = useAuthStore()

  const { data: messages, isLoading } = useMessages(id)
  const sendMessage = useSendMessage(id, profile?.id ?? '')

  const [text, setText] = useState('')
  const listRef = useRef<FlatList>(null)

  // Infos de la conversation (interlocuteur)
  const { data: conversation } = useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*, user_a:users!user_a_id(id, first_name, last_name), user_b:users!user_b_id(id, first_name, last_name), trip:trips(id, departure_address, arrival_address)')
        .eq('id', id)
        .single()
      return data
    },
  })

  const otherUser = conversation?.user_a_id === profile?.id
    ? conversation?.user_b
    : conversation?.user_a

  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }, [messages?.length])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    try {
      await sendMessage.mutateAsync(trimmed)
      listRef.current?.scrollToEnd({ animated: true })
    } catch {
      setText(trimmed)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navName}>
            {otherUser?.first_name} {otherUser?.last_name}
          </Text>
          {conversation?.trip && (
            <Text style={styles.navTrip} numberOfLines={1}>
              {conversation.trip.departure_address} → {conversation.trip.arrival_address}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>
                  Démarrez la conversation 👋
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.sender_id === profile?.id}
            />
          )}
        />

        {/* Zone de saisie */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Votre message..."
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            placeholderTextColor={COLORS.textMuted}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            style={[styles.sendBtn, (!text.trim() || sendMessage.isPending) && styles.sendBtnDisabled]}
          >
            <Ionicons name="send" size={20} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1 },
  navName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  navTrip: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  messagesList: { paddingVertical: SPACING.md, paddingBottom: SPACING.lg },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: 15, color: COLORS.textMuted },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.textMuted },
})
