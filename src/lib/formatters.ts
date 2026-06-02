/**
 * Formate automatiquement une saisie de date en JJ/MM/AAAA
 * Exemple : "22021996" → "22/02/1996"
 * Gère également l'effacement (les "/" disparaissent automatiquement)
 */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Formate automatiquement une saisie d'heure en HH:MM
 * Exemple : "1850" → "18:50"
 * Gère également l'effacement (le ":" disparaît automatiquement)
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/**
 * Formate automatiquement un numéro de téléphone français en XX XX XX XX XX
 * Exemple : "0123456789" → "01 23 45 67 89"
 * Gère l'effacement en retirant les espaces à la volée
 */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ')
}
