import { Link, Stack } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS, SPACING } from '@/constants/theme'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page introuvable' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page introuvable</Text>
        <Link href="/(app)" style={styles.link}>
          Retour à l&apos;accueil
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  link: { color: COLORS.primary, fontSize: 16 },
})
