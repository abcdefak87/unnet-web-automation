import { useRouter as useNextRouter } from 'next/router'
import { useCallback } from 'react'

export const useRouter = () => {
  const router = useNextRouter()

  const safePush = useCallback(async (url: string) => {
    try {
      await router.push(url)
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('Abort')) {
        console.log('Navigation was cancelled, this is normal:', error.message)
        return
      }
      console.error('Navigation error:', error)
    }
  }, [router])

  const safeReplace = useCallback(async (url: string) => {
    try {
      await router.replace(url)
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('Abort')) {
        console.log('Navigation was cancelled, this is normal:', error.message)
        return
      }
      console.error('Navigation error:', error)
    }
  }, [router])

  return {
    ...router,
    push: safePush,
    replace: safeReplace,
  }
}
