import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Only redirect if we're actually on the index page (/)
    if (window.location.pathname !== '/') {
      return
    }
    
    if (!loading) {
      if (user) {
        // Check if there's a saved path to restore
        const savedPath = localStorage.getItem('lastVisitedPath')
        
        if (savedPath && savedPath !== '/login' && savedPath !== '/') {
          try {
            router.push(savedPath)
          } catch (error) {
            console.error('Router push error:', error)
            window.location.href = savedPath
          }
          return
        }
        
        try {
          router.push('/dashboard')
        } catch (error) {
          console.error('Router push error:', error)
          window.location.href = '/dashboard'
        }
      } else {
        try {
          router.push('/login')
        } catch (error) {
          console.error('Router push error:', error)
          window.location.href = '/login'
        }
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return null
}

