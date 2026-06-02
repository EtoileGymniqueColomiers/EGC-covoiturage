import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ScrollView, ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  format, parse, isValid, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  getMonth, getYear, setMonth, setYear,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { COLORS, RADIUS, SPACING, SHADOW } from '@/constants/theme'

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYS_FR   = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const CELL          = 40
const SELECTOR_ITEM = 48

// ─── Utilitaire ───────────────────────────────────────────────────────────────

function parseValue(str: string): Date | null {
  if (!str || str.length < 10) return null
  try {
    const d = parse(str, 'dd/MM/yyyy', new Date())
    return isValid(d) ? d : null
  } catch { return null }
}

// ─── Sélecteur Mois / Année ───────────────────────────────────────────────────

interface SelectorProps {
  viewDate: Date
  minYear: number
  maxYear: number
  onConfirm: (month: number, year: number) => void
  onCancel: () => void
}

function MonthYearSelector({ viewDate, minYear, maxYear, onConfirm, onCancel }: SelectorProps) {
  const [tempMonth, setTempMonth] = useState(getMonth(viewDate))
  const [tempYear,  setTempYear]  = useState(getYear(viewDate))

  const monthRef = useRef<ScrollView>(null)
  const yearRef  = useRef<ScrollView>(null)
  const years    = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  useEffect(() => {
    // Scroll aux valeurs sélectionnées dès l'ouverture
    const t = setTimeout(() => {
      monthRef.current?.scrollTo({ y: tempMonth * SELECTOR_ITEM, animated: false })
      yearRef.current?.scrollTo({ y: (tempYear - minYear) * SELECTOR_ITEM, animated: false })
    }, 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <View>
      {/* Header */}
      <View style={sel.header}>
        <TouchableOpacity onPress={onCancel} style={sel.btn}>
          <Text style={sel.cancelText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={sel.title}>Choisir le mois et l'année</Text>
        <TouchableOpacity onPress={() => onConfirm(tempMonth, tempYear)} style={sel.btn}>
          <Text style={sel.confirmText}>Valider</Text>
        </TouchableOpacity>
      </View>

      {/* Colonnes */}
      <View style={sel.columns}>

        {/* Mois */}
        <ScrollView
          ref={monthRef}
          style={sel.column}
          showsVerticalScrollIndicator={false}
        >
          {MONTHS_FR.map((name, i) => (
            <TouchableOpacity
              key={i}
              style={[sel.item, tempMonth === i && sel.itemSelected]}
              onPress={() => setTempMonth(i)}
              activeOpacity={0.7}
            >
              <Text style={[sel.itemText, tempMonth === i && sel.itemTextSelected]}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={sel.divider} />

        {/* Années */}
        <ScrollView
          ref={yearRef}
          style={[sel.column, { width: 90 }]}
          showsVerticalScrollIndicator={false}
        >
          {years.map((year) => (
            <TouchableOpacity
              key={year}
              style={[sel.item, tempYear === year && sel.itemSelected]}
              onPress={() => setTempYear(year)}
              activeOpacity={0.7}
            >
              <Text style={[sel.itemText, tempYear === year && sel.itemTextSelected]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

const sel = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  btn:         { paddingHorizontal: SPACING.xs, paddingVertical: 4 },
  title:       { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1, textAlign: 'center' },
  cancelText:  { fontSize: 15, color: COLORS.textSecondary },
  confirmText: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },

  columns: {
    flexDirection: 'row',
    height: 260,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  column: { flex: 1 },
  divider: {
    width: 1, backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm, marginVertical: SPACING.sm,
  },

  item: {
    height: SELECTOR_ITEM,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 2,
  },
  itemSelected:     { backgroundColor: COLORS.primaryLight },
  itemText:         { fontSize: 15, color: COLORS.text },
  itemTextSelected: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
})

// ─── Composant principal ──────────────────────────────────────────────────────

interface DatePickerInputProps {
  label?: string
  placeholder?: string
  value: string
  onChange: (date: string) => void
  error?: string
  hint?: string
  minimumDate?: Date
  maximumDate?: Date
  containerStyle?: ViewStyle
}

export function DatePickerInput({
  label,
  placeholder = 'JJ/MM/AAAA',
  value,
  onChange,
  error,
  hint,
  minimumDate,
  maximumDate,
  containerStyle,
}: DatePickerInputProps) {
  const [show,         setShow]         = useState(false)
  const [showSelector, setShowSelector] = useState(false)

  const minYear = minimumDate?.getFullYear() ?? 1930
  const maxYear = maximumDate?.getFullYear() ?? (new Date().getFullYear() + 2)

  const selectedDate              = parseValue(value)
  const [viewDate, setViewDate]   = useState(selectedDate ?? new Date())

  function handleOpen() {
    setViewDate(selectedDate ?? new Date())
    setShowSelector(false)
    setShow(true)
  }

  function handleSelectDay(day: Date) {
    if (minimumDate && day < minimumDate) return
    if (maximumDate && day > maximumDate) return
    onChange(format(day, 'dd/MM/yyyy'))
    setShow(false)
  }

  function handleConfirmSelector(month: number, year: number) {
    let d = setMonth(viewDate, month)
    d = setYear(d, year)
    setViewDate(d)
    setShowSelector(false)
  }

  // Grille calendrier
  const monthStart = startOfMonth(viewDate)
  const monthEnd   = endOfMonth(viewDate)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })

  const displayValue = value || null

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.field, !!error && styles.fieldError]}
        onPress={handleOpen}
        activeOpacity={0.8}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={displayValue ? COLORS.primary : COLORS.textMuted}
          style={styles.icon}
        />
        <Text style={[styles.fieldValue, !displayValue && styles.placeholder]}>
          {displayValue ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShow(false)} />

        <View style={styles.sheet}>

          {showSelector ? (
            /* ── Sélecteur mois / année ── */
            <MonthYearSelector
              viewDate={viewDate}
              minYear={minYear}
              maxYear={maxYear}
              onConfirm={handleConfirmSelector}
              onCancel={() => setShowSelector(false)}
            />
          ) : (
            /* ── Calendrier ── */
            <>
              {/* Navigation */}
              <View style={styles.navRow}>
                <TouchableOpacity
                  onPress={() => setViewDate(v => subMonths(v, 1))}
                  style={styles.navBtn}
                >
                  <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
                </TouchableOpacity>

                {/* Tap sur le mois → ouvre le sélecteur */}
                <TouchableOpacity onPress={() => setShowSelector(true)} style={styles.monthBtn}>
                  <Text style={styles.monthTitle}>
                    {format(viewDate, 'MMMM yyyy', { locale: fr })}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setViewDate(v => addMonths(v, 1))}
                  style={styles.navBtn}
                >
                  <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              {/* En-tête jours */}
              <View style={styles.weekRow}>
                {DAYS_FR.map((d) => (
                  <Text key={d} style={styles.weekDay}>{d}</Text>
                ))}
              </View>

              {/* Grille */}
              <View style={styles.grid}>
                {calDays.map((day) => {
                  const isSelected  = selectedDate ? isSameDay(day, selectedDate) : false
                  const isThisMonth = isSameMonth(day, viewDate)
                  const isDisabled  =
                    (minimumDate != null && day < minimumDate) ||
                    (maximumDate != null && day > maximumDate)
                  const isTodayDay  = isToday(day)

                  return (
                    <TouchableOpacity
                      key={day.toISOString()}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isTodayDay && !isSelected && styles.dayCellToday,
                      ]}
                      onPress={() => handleSelectDay(day)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.dayText,
                        !isThisMonth && styles.dayTextOtherMonth,
                        isSelected   && styles.dayTextSelected,
                        isTodayDay   && !isSelected && styles.dayTextToday,
                        isDisabled   && styles.dayTextDisabled,
                      ]}>
                        {format(day, 'd')}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={() => setShow(false)}>
                <Text style={styles.closeBtnText}>Fermer</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: 6 },
  label:     { fontSize: 14, fontWeight: '500', color: COLORS.text },

  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 13,
  },
  fieldError:  { borderColor: COLORS.error },
  icon:        { marginRight: SPACING.sm },
  fieldValue:  { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  placeholder: { color: COLORS.textMuted, fontWeight: '400' },
  error:       { fontSize: 12, color: COLORS.error },
  hint:        { fontSize: 12, color: COLORS.textMuted },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: 36, ...SHADOW.lg,
  },

  // Navigation
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  navBtn:    { padding: SPACING.sm },
  monthBtn:  { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs },
  monthTitle: {
    fontSize: 17, fontWeight: '700', color: COLORS.primary,
    textTransform: 'capitalize',
  },

  // Semaine
  weekRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.xs,
  },
  weekDay: {
    width: CELL, textAlign: 'center',
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase',
  },

  // Grille
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md, rowGap: 4,
  },
  dayCell:         { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center', borderRadius: CELL / 2 },
  dayCellSelected: { backgroundColor: COLORS.primary },
  dayCellToday:    { backgroundColor: COLORS.primaryLight },

  dayText:            { fontSize: 15, color: COLORS.text },
  dayTextOtherMonth:  { color: COLORS.border },
  dayTextSelected:    { color: '#fff', fontWeight: '700' },
  dayTextToday:       { color: COLORS.primary, fontWeight: '700' },
  dayTextDisabled:    { color: COLORS.border },

  closeBtn: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 13, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
