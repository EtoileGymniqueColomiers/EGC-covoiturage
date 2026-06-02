import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS, RADIUS } from '@/constants/theme'

interface AvatarProps {
  firstName?: string | null
  lastName?: string | null
  size?: number
}

export function Avatar({ firstName, lastName, size = 40 }: AvatarProps) {
  const initials = [firstName?.[0], lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?'

  const fontSize = size * 0.38

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: COLORS.primary,
    fontWeight: '700',
  },
})
