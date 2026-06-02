import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Message } from '@/types'
import { COLORS, RADIUS, SPACING } from '@/constants/theme'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.content, isOwn && styles.contentOwn]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isOwn && styles.timeOwn]}>
          {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 3,
    paddingHorizontal: SPACING.md,
  },
  rowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    paddingHorizontal: 14,
    gap: 4,
  },
  bubbleOwn: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  content: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  contentOwn: { color: COLORS.textInverse },
  time: { fontSize: 11, color: COLORS.textMuted, alignSelf: 'flex-end' },
  timeOwn: { color: 'rgba(255,255,255,0.65)' },
})
