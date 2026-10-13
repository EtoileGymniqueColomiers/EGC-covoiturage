import { NativeModules, Platform, Settings } from 'react-native'

export type SnapshotLaunchConfig = {
  email: string
  password: string
}

function readSetting(key: string): unknown {
  const fromSettings = Settings.get(key)
  if (fromSettings != null) return fromSettings

  const bag = NativeModules.SettingsManager?.settings as
    | Record<string, unknown>
    | undefined
  return bag?.[key]
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 'YES' || value === '1' || value === 1
}

/** True when Fastlane Snapshot launched the app (`-FASTLANE_SNAPSHOT YES`). */
export function isSnapshotMode(): boolean {
  return Platform.OS === 'ios' && isTruthyFlag(readSetting('FASTLANE_SNAPSHOT'))
}

/**
 * Reads snapshot launch args (-KEY VALUE) from iOS NSUserDefaults
 * via React Native Settings. AppDelegate copies Fastlane args into the app
 * domain first — SettingsManager.dictionaryRepresentation skips NSArgumentDomain.
 */
export function getSnapshotLaunchConfig(): SnapshotLaunchConfig | null {
  if (!isSnapshotMode()) return null

  const email = readSetting('SNAPSHOT_EMAIL')
  const password = readSetting('SNAPSHOT_PASSWORD')
  if (typeof email !== 'string' || !email.trim()) return null
  if (typeof password !== 'string' || !password) return null

  return { email: email.trim(), password }
}
