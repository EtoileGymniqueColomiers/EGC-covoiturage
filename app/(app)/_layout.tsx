import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { PlatformPressable } from '@react-navigation/elements'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { COLORS } from '@/constants/theme'
import { useAuthStore } from '@/stores/auth.store'
import { useUnreadNotificationsCount } from '@/hooks/useNotifications'

function tabButton(testID: string) {
  return function TabButton(props: BottomTabBarButtonProps) {
    return <PlatformPressable {...props} testID={testID} />
  }
}

function formatBadge(count: number): number | string | undefined {
  if (count <= 0) return undefined
  return count > 99 ? '99+' : count
}

export default function AppLayout() {
  const { profile } = useAuthStore()
  const unreadNotifications = useUnreadNotificationsCount(profile?.id)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
      }}
    >
      {/* ── Onglets visibles ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarButton: tabButton('tab-accueil'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips/index"
        options={{
          title: 'Trajets',
          tabBarButton: tabButton('tab-trajets'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: 'Messages',
          tabBarButton: tabButton('tab-messages'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications/index"
        options={{
          title: 'Notifications',
          tabBarButton: tabButton('tab-notifications'),
          tabBarBadge: formatBadge(unreadNotifications),
          tabBarBadgeStyle: {
            backgroundColor: COLORS.error,
            fontSize: 10,
            fontWeight: '700',
            minWidth: 16,
            height: 16,
            lineHeight: 14,
            borderRadius: 8,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarButton: tabButton('tab-profil'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* ── Écrans cachés de la barre (accessibles par navigation) ── */}
      <Tabs.Screen
        name="trips/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="trips/create"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="messages/[id]"
        options={{ href: null }}
      />
    </Tabs>
  )
}
