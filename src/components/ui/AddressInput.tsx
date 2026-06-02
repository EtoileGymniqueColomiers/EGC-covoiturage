import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { searchAddress, GeoResult } from '@/lib/geocoding'
import { COLORS, RADIUS, SPACING, SHADOW } from '@/constants/theme'

interface AddressInputProps {
  label?: string
  placeholder?: string
  value: string
  onSelect: (address: string, lat?: number, lng?: number) => void
  error?: string
  hint?: string
  containerStyle?: ViewStyle
}

export function AddressInput({
  label,
  placeholder = 'Rechercher une adresse...',
  value,
  onSelect,
  error,
  hint,
  containerStyle,
}: AddressInputProps) {
  const [query, setQuery]         = useState(value)
  const [results, setResults]     = useState<GeoResult[]>([])
  const [loading, setLoading]     = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [showList, setShowList]   = useState(false)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Vrai uniquement si l'utilisateur a sélectionné une adresse depuis la liste
  const wasSelectedRef = useRef(value.trim().length > 0)

  // Synchronise si la valeur externe change (ex: pré-remplissage)
  useEffect(() => {
    setQuery(value)
    wasSelectedRef.current = value.trim().length > 0
  }, [value])

  function handleChange(text: string) {
    setQuery(text)
    setShowList(false)
    setResults([])
    wasSelectedRef.current = false   // L'utilisateur retape → plus de sélection valide
    onSelect(text, undefined, undefined)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.trim().length < 3) return

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const found = await searchAddress(text)
        setResults(found)
        setShowList(found.length > 0)
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function handleSelect(result: GeoResult) {
    const short = result.displayName.split(',').slice(0, 3).join(',').trim()
    wasSelectedRef.current = true    // Sélection validée depuis la liste
    setQuery(short)
    setResults([])
    setShowList(false)
    onSelect(short, result.lat, result.lng)
  }

  function handleClear() {
    wasSelectedRef.current = false
    setQuery('')
    setResults([])
    setShowList(false)
    onSelect('', undefined, undefined)
  }

  function handleBlur() {
    setIsFocused(false)
    setTimeout(() => {
      setShowList(false)
      // Si l'utilisateur n'a pas sélectionné depuis la liste → on efface
      if (!wasSelectedRef.current && query.trim().length > 0) {
        setQuery('')
        onSelect('', undefined, undefined)
      }
    }, 200)
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Champ de saisie */}
      <View style={[
        styles.inputWrapper,
        isFocused && styles.inputFocused,
        !!error && styles.inputError,
      ]}>
        <Ionicons
          name="location-outline"
          size={18}
          color={isFocused ? COLORS.primary : COLORS.textMuted}
          style={styles.icon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        )}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Liste des suggestions */}
      {showList && results.length > 0 && (
        <View style={styles.resultList}>
          {results.map((result, index) => {
            const parts = result.displayName.split(',')
            const main  = parts.slice(0, 2).join(',').trim()
            const sub   = parts.slice(2, 4).join(',').trim()

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.resultItem,
                  index === results.length - 1 && styles.resultItemLast,
                ]}
                onPress={() => handleSelect(result)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={16} color={COLORS.primary} style={styles.resultIcon} />
                <View style={styles.resultText}>
                  <Text style={styles.resultMain} numberOfLines={1}>{main}</Text>
                  {sub ? <Text style={styles.resultSub} numberOfLines={1}>{sub}</Text> : null}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: COLORS.text },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  inputFocused: { borderColor: COLORS.primary },
  inputError:   { borderColor: COLORS.error },
  icon:         { marginRight: SPACING.sm },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
  },
  loader:   { marginLeft: SPACING.sm },
  clearBtn: { padding: 4 },

  resultList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderTopWidth: 0,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.md,
    zIndex: 999,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  resultItemLast: { borderBottomWidth: 0 },
  resultIcon:     { marginRight: SPACING.sm, marginTop: 1 },
  resultText:     { flex: 1 },
  resultMain:     { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  resultSub:      { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  error: { fontSize: 12, color: COLORS.error },
  hint:  { fontSize: 12, color: COLORS.textMuted },
})
