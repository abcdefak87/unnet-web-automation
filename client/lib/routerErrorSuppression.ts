// Router error suppression for Next.js
export const suppressRouterErrors = () => {
  if (typeof window === 'undefined') return

  // Override console.error to filter out router AbortError
  const originalConsoleError = console.error
  console.error = (...args: any[]) => {
    const message = args.join(' ')
    
    // Suppress specific router AbortError messages
    if (
      message.includes('Abort fetching component for route') ||
      message.includes('AbortError') ||
      message.includes('cancelled') ||
      message.includes('Abort')
    ) {
      // Log as info instead of error
      console.log('Router navigation cancelled (normal behavior):', ...args)
      return
    }
    
    // Call original console.error for other errors
    originalConsoleError.apply(console, args)
  }

  // Override window.onerror to suppress AbortError
  const originalOnError = window.onerror
  window.onerror = (message, source, lineno, colno, error) => {
    if (
      error?.name === 'AbortError' ||
      (typeof message === 'string' && (
        message.includes('Abort fetching component') ||
        message.includes('AbortError') ||
        message.includes('cancelled') ||
        message.includes('Abort')
      ))
    ) {
      console.log('Router AbortError suppressed:', message)
      return true // Prevent default error handling
    }
    
    // Call original error handler for other errors
    if (originalOnError) {
      return originalOnError.call(window, message, source, lineno, colno, error)
    }
    return false
  }

  // Override unhandledrejection to suppress AbortError promises
  const originalOnUnhandledRejection = window.onunhandledrejection
  window.onunhandledrejection = (event) => {
    if (
      event.reason?.name === 'AbortError' ||
      (typeof event.reason === 'string' && (
        event.reason.includes('Abort fetching component') ||
        event.reason.includes('AbortError') ||
        event.reason.includes('cancelled') ||
        event.reason.includes('Abort')
      ))
    ) {
      console.log('Router AbortError promise suppressed:', event.reason)
      event.preventDefault()
      return
    }
    
    // Call original handler for other rejections
    if (originalOnUnhandledRejection) {
      return originalOnUnhandledRejection.call(window, event)
    }
  }

  console.log('Router error suppression activated')
}
