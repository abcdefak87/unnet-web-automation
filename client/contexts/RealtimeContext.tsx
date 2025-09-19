import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { useAuth } from './AuthContext'
import websocketService from '../lib/websocket'
import toast from 'react-hot-toast'

interface RealtimeContextType {
  isConnected: boolean
  notifications: Notification[]
  markAsRead: (id: string) => void
  clearAll: () => void
}

interface Notification {
  id: string
  type: 'job' | 'customer' | 'inventory' | 'system'
  title: string
  message: string
  timestamp: Date
  read: boolean
  data?: any
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const connectionAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000 // 3 seconds
  const isConnecting = useRef(false)

  useEffect(() => {
    if (!loading && user?.id && !isConnecting.current) {
      isConnecting.current = true
      
      // Add delay to ensure server is ready and prevent rapid reconnections
      const connectTimer = setTimeout(() => {
        if (connectionAttempts.current >= maxReconnectAttempts) {
          console.warn('Max reconnection attempts reached, stopping WebSocket connections')
          isConnecting.current = false
          return
        }

        const socket = websocketService.connect(user.id, user.role)
        if (!socket) {
          setIsConnected(false)
          isConnecting.current = false
          return
        }
        
        setIsConnected(socket.connected)
        connectionAttempts.current++
        
        // Connection status updates
        socket.on('connect', () => {
          setIsConnected(true)
          connectionAttempts.current = 0 // Reset on successful connection
          isConnecting.current = false
          toast.success('🔗 Real-time connection established', { duration: 2000 })
        })
        
        socket.on('disconnect', (reason) => {
          setIsConnected(false)
          console.log('WebSocket disconnected:', reason)
          
          // Only attempt reconnection if it wasn't a manual disconnect
          if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
            setTimeout(() => {
              if (!isConnecting.current) {
                isConnecting.current = false
              }
            }, reconnectDelay)
          }
        })

        socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error)
          setIsConnected(false)
          isConnecting.current = false
          
          // Exponential backoff for reconnection
          const backoffDelay = Math.min(reconnectDelay * Math.pow(2, connectionAttempts.current), 30000)
          setTimeout(() => {
            if (!isConnecting.current) {
              isConnecting.current = false
            }
          }, backoffDelay)
        })
      }, 1000) // Increased delay to 1 second
      
      return () => {
        clearTimeout(connectTimer)
        if (websocketService) {
          websocketService.disconnect()
        }
        setIsConnected(false)
        isConnecting.current = false
      }
    }
  }, [user, loading])
  
  // Separate effect for event listeners to avoid cleanup issues
  useEffect(() => {
    if (!loading && user?.id && websocketService.isConnected()) {
      // Job updates
      websocketService.onJobUpdate((data) => {
        const notification: Notification = {
          id: Date.now().toString(),
          type: 'job',
          title: 'Job Update',
          message: getJobUpdateMessage(data),
          timestamp: new Date(),
          read: false,
          data
        }
        
        setNotifications(prev => [notification, ...prev.slice(0, 49)]) // Keep last 50
        
        // Show toast notification
        toast.success(`📋 ${notification.message}`, {
          duration: 4000,
          icon: '🔄'
        })
      })

      // Customer updates
      websocketService.onUserUpdate((data) => {
        if (data.type === 'customer') {
          const notification: Notification = {
            id: Date.now().toString(),
            type: 'customer',
            title: 'Customer Update',
            message: getCustomerUpdateMessage(data),
            timestamp: new Date(),
            read: false,
            data
          }
          
          setNotifications(prev => [notification, ...prev.slice(0, 49)])
          
          toast.success(`👤 ${notification.message}`, {
            duration: 4000,
            icon: '🆕'
          })
        }
      })

      // System notifications
      websocketService.onSystemNotification((data) => {
        const notification: Notification = {
          id: Date.now().toString(),
          type: 'system',
          title: 'System Notification',
          message: data.message || 'System update',
          timestamp: new Date(),
          read: false,
          data
        }
        
        setNotifications(prev => [notification, ...prev.slice(0, 49)])
        
        toast(notification.message, {
          duration: 5000,
          icon: '🔔'
        })
      })

      // User-specific notifications
      websocketService.onUserNotification((data) => {
        const notification: Notification = {
          id: Date.now().toString(),
          type: data.type || 'system',
          title: data.title || 'Notification',
          message: data.message,
          timestamp: new Date(),
          read: false,
          data
        }
        
        setNotifications(prev => [notification, ...prev.slice(0, 49)])
        
        toast(notification.message, {
          duration: 5000,
          icon: getNotificationIcon(data.type)
        })
      })

    }
  }, [user, loading, isConnected])

  const getJobUpdateMessage = (data: any): string => {
    const action = data.action?.toLowerCase();
    switch (action) {
      case 'created':
        return `New job created: ${data.job?.jobNumber || 'Unknown'}`
      case 'updated':
        return `Job ${data.job?.jobNumber || 'Unknown'} updated`
      case 'assigned':
        return `Job ${data.job?.jobNumber || 'Unknown'} assigned to technician`
      case 'started':
      case 'in_progress':
        return `Job ${data.job?.jobNumber || 'Unknown'} started`
      case 'completed':
        return `✅ Job ${data.job?.jobNumber || 'Unknown'} completed successfully!`
      case 'cancelled':
        return `Job ${data.job?.jobNumber || 'Unknown'} cancelled`
      case 'deleted':
        return `🗑️ Job ${data.job?.jobNumber || 'Unknown'} deleted`
      default:
        return `Job ${data.job?.jobNumber || 'Unknown'} updated`
    }
  }

  const getCustomerUpdateMessage = (data: any): string => {
    switch (data.action) {
      case 'created':
        return `New customer registered: ${data.customer?.name || 'Unknown'}`
      case 'updated':
        return `Customer ${data.customer?.name || 'Unknown'} updated`
      default:
        return `Customer ${data.customer?.name || 'Unknown'} updated`
    }
  }

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'job': return '📋'
      case 'customer': return '👤'
      case 'inventory': return '📦'
      case 'system': return '🔔'
      default: return '📢'
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }

  const clearAll = () => {
    setNotifications([])
  }

  return (
    <RealtimeContext.Provider value={{
      isConnected,
      notifications,
      markAsRead,
      clearAll
    }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

