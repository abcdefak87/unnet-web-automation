// Utility functions for localStorage operations
export interface SavedCredentials {
  username: string
  password: string
  rememberMe: boolean
}

const CREDENTIALS_KEY = 'unnet_saved_credentials'

export const saveCredentials = (credentials: SavedCredentials): void => {
  try {
    if (typeof window !== 'undefined') {
      if (credentials.rememberMe) {
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
      } else {
        localStorage.removeItem(CREDENTIALS_KEY)
      }
    }
  } catch (error) {
    console.error('Failed to save credentials:', error)
  }
}

export const loadCredentials = (): SavedCredentials | null => {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CREDENTIALS_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    }
  } catch (error) {
    console.error('Failed to load credentials:', error)
  }
  return null
}

export const clearCredentials = (): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CREDENTIALS_KEY)
    }
  } catch (error) {
    console.error('Failed to clear credentials:', error)
  }
}
