import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from '../lib/router'
import Cookies from 'js-cookie'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { saveCredentials, clearCredentials } from '../lib/storage'

interface User {
  id: string
  email: string
  name: string
  role: 'superadmin' | 'admin' | 'gudang' | 'user' | 'technician'
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>
  logout: () => void
  loading: boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)


export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const isNavigating = useRef(false)
  const lastProfileFetch = useRef(0)
  const profileCacheTimeout = 30000 // 30 seconds cache

  const safeNavigate = useCallback(async (url: string, replace = false) => {
    if (isNavigating.current) return false
    
    try {
      isNavigating.current = true
      
      // Add a small delay to prevent race conditions
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check if we're already on the target route
      if (router.pathname === url) {
        return true
      }
      
      if (replace) {
        await router.replace(url)
      } else {
        await router.push(url)
      }
      return true
    } catch (error: any) {
      console.error('Navigation error:', error)
      // Handle specific navigation errors
      if (error.name === 'AbortError' || error.message?.includes('Abort')) {
        console.log('Navigation was cancelled, ignoring error')
        return true
      }
      return false
    } finally {
      setTimeout(() => {
        isNavigating.current = false
      }, 200)
    }
  }, [router])

  const fetchUser = useCallback(async (force = false) => {
    try {
      // Check cache timeout to prevent excessive API calls
      const now = Date.now()
      if (!force && now - lastProfileFetch.current < profileCacheTimeout) {
        console.log('Using cached user profile, skipping API call')
        return
      }
      
      lastProfileFetch.current = now
      const response = await api.get('/auth/profile')
      setUser(response.data.user)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      Cookies.remove('token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = Cookies.get('token')
    if (token) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [fetchUser])

  useEffect(() => {
    // Response interceptor to handle errors
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          Cookies.remove('token')
          setUser(null)
          // Don't redirect automatically, let the component handle it
        } else if (error.response?.status === 500) {
          toast.error('Terjadi kesalahan server')
        }
        return Promise.reject(error)
      }
    )

    return () => {
      api.interceptors.response.eject(interceptor)
    }
  }, [router, safeNavigate])

  const login = async (username: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      const response = await api.post('/auth/login', { username, password })
      const { token, refreshToken, user } = response.data

      Cookies.set('token', token, { expires: 1 }) // 1 day
      if (refreshToken) {
        Cookies.set('refreshToken', refreshToken, { expires: 7 }) // 7 days
      }
      setUser(user)
      
      // Save credentials if Remember Me is checked
      saveCredentials({ username, password, rememberMe })
      
      toast.success(`Selamat datang, ${user.name}!`)
      
      // Let the calling component handle navigation
      // This allows for more flexible redirect logic
      
      return true
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login gagal'
      toast.error(message)
      return false
    }
  }

  const logout = async () => {
    try {
      // Call logout API to invalidate refresh token
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      // Always clear tokens and credentials
      Cookies.remove('token')
      Cookies.remove('refreshToken')
      setUser(null)
      clearCredentials()
      toast.success('Logout berhasil')
      safeNavigate('/login', true)
    }
  }

  const value = {
    user,
    login,
    logout,
    loading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
