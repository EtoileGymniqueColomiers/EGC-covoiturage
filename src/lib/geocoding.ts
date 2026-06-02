export interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

/** Géocodage via Nominatim (OpenStreetMap) — gratuit, sans API key */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  try {
    const encoded = encodeURIComponent(address)
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=fr`

    const res = await fetch(url, {
      headers: {
        // Obligatoire pour respecter la politique d'utilisation de Nominatim
        'User-Agent': 'EGC-Covoiturage/1.0 (contact@egc.fr)',
        'Accept-Language': 'fr',
      },
    })

    const data = await res.json()
    if (!data || data.length === 0) return null

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    }
  } catch {
    return null
  }
}

/** Suggestions d'adresses pour l'autocomplete */
export async function searchAddress(query: string): Promise<GeoResult[]> {
  if (query.length < 3) return []

  try {
    const encoded = encodeURIComponent(query)
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=fr`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'EGC-Covoiturage/1.0 (contact@egc.fr)',
        'Accept-Language': 'fr',
      },
    })

    const data = await res.json()
    return (data || []).map((item: { lat: string; lon: string; display_name: string }) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
    }))
  } catch {
    return []
  }
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
