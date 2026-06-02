import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { COLORS, RADIUS, SPACING } from '@/constants/theme'

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  style?: ViewStyle
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: COLORS.successLight, text: COLORS.success },
  error: { bg: COLORS.errorLight, text: COLORS.error },
  warning: { bg: COLORS.warningLight, text: COLORS.warning },
  info: { bg: COLORS.infoLight, text: COLORS.info },
  neutral: { bg: COLORS.borderLight, text: COLORS.textSecondary },
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const { bg, text } = VARIANT_STYLES[variant]

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
})
