import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { api } from '../lib/api'
import websocketService from '../lib/websocket'
import { 
  MessageCircle, 
  Send, 
  Users, 
  Clock,
  CheckCircle,
  AlertCircle,
  Bot,
  Settings,
  Activity,
  Smartphone
} from 'lucide-react'
import toast from 'react-hot-toast'

interface BotStatus {
  status: string
  message?: string
  lastConnected?: string
  details?: {
    status: string
    isConnected?: boolean
    uptime: number
    hasQR: boolean
    lastConnected?: string
  }
}

export default function WhatsApp() {
  const { user } = useAuth()
  const router = useRouter()
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalTechnicians: 0,
    activeTechnicians: 0,
    totalMessages: 0,
    activeJobs: 0,
    connectedDevices: 0
  })

  useEffect(() => {
    fetchBotStatus()
    fetchStats()
    
    // Auto-refresh status every 10 seconds
    const interval = setInterval(() => {
      fetchBotStatus()
      fetchStats()
    }, 10000)
    
    // Real-time status updates via WebSocket
    const handleWhatsAppStatusUpdate = (data: any) => {
      console.log('WhatsApp status update received:', data)
      if (data.status) {
        const isConnected = data.connected === true || data.status === 'connected' || data.status === 'active'
        setBotStatus(prev => ({
          ...prev,
          status: isConnected ? 'active' : 'offline',
          message: isConnected ? 'Bot sedang berjalan' : 'Bot offline',
          details: {
            ...prev?.details,
            status: data.status,
            isConnected: isConnected,
            uptime: data.uptime || 0,
            hasQR: false
          },
          lastConnected: data.lastUpdate
        }))
      }
    }
    
    // Connect to WebSocket for real-time updates
    if (user) {
      websocketService.connect(user.id, user.role)
      websocketService.onWhatsAppStatusUpdate(handleWhatsAppStatusUpdate)
    }
    
    return () => {
      clearInterval(interval)
      websocketService.offWhatsAppStatusUpdate(handleWhatsAppStatusUpdate)
    }
  }, [user])

  const fetchBotStatus = async () => {
    try {
      const response = await api.get('/whatsapp/status')
      const data = response.data
      
      console.log('Bot status data received:', data)
      
      // Map the response to the expected format
      const isConnected = data.connected === true || data.status === 'connected' || data.status === 'active'
      setBotStatus({
        status: isConnected ? 'active' : 'offline',
        message: isConnected ? 'Bot sedang berjalan' : 'Bot offline',
        details: {
          status: data.status,
          isConnected: isConnected,
          uptime: data.uptime || 0,
          hasQR: false
        },
        lastConnected: data.lastUpdate
      })
    } catch (error) {
      console.error('Failed to fetch bot status:', error)
      setBotStatus({ status: 'error', message: 'Gagal terhubung ke WhatsApp' })
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/whatsapp/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const testBot = async () => {
    try {
      toast.loading('Menguji koneksi WhatsApp...')
      const response = await api.post('/monitoring/whatsapp/test', {
        phone: '6282229261247',
        message: 'Pesan test dari Sistem Manajemen ISP'
      })
      toast.dismiss()
      if (response.data.success) {
        toast.success('Test WhatsApp berhasil! Admin akan menerima notifikasi.')
      } else {
        toast.error('Test WhatsApp gagal: ' + (response.data.message || 'Error tidak diketahui'))
      }
      fetchBotStatus()
    } catch (error: any) {
      toast.dismiss()
      toast.error('Test WhatsApp gagal: ' + (error.response?.data?.error || error.message))
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Manajemen Bot WhatsApp - Sistem Manajemen ISP</title>
        <meta name="description" content="Pantau dan kelola bot WhatsApp untuk koordinasi teknisi" />
      </Head>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Smartphone className="h-8 w-8 text-green-600 mr-3" />
                  Manajemen Bot WhatsApp
                </h1>
                <p className="text-gray-600 mt-1">
                  Pantau dan kelola bot WhatsApp untuk koordinasi teknisi
                </p>
              </div>
              <button
                onClick={testBot}
                className="btn-primary flex items-center"
              >
                <Activity className="h-4 w-4 mr-2" />
                Uji Bot
              </button>
            </div>
          </div>

          {/* Bot Status */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Bot</h2>
            <div className="flex items-center space-x-4">
              {botStatus?.status === 'active' ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">Bot sedang berjalan</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">Bot offline</span>
                </div>
              )}
              <div className="text-sm text-gray-500">
                Terakhir diperbarui: {new Date().toLocaleString()}
              </div>
            </div>
            {botStatus?.message && (
              <p className="mt-2 text-sm text-gray-600">{botStatus.message}</p>
            )}
            {botStatus?.details && (
              <div className="mt-2 text-xs text-gray-500">
                Koneksi: {botStatus.details.status} | 
                Waktu Aktif: {Math.floor((botStatus.details.uptime || 0) / 1000)}s
              </div>
            )}
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="card">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Teknisi</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalTechnicians}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Teknisi Aktif</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.activeTechnicians}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <MessageCircle className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pesan Terkirim</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalMessages}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Job Aktif</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.activeJobs}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <Smartphone className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Perangkat Terhubung</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.connectedDevices}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bot Commands */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Perintah WhatsApp yang Tersedia</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">/daftar [phone]</h3>
                <p className="text-sm text-gray-600 mt-1">Daftarkan teknisi dengan nomor telepon</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">/jobs</h3>
                <p className="text-sm text-gray-600 mt-1">Lihat job yang tersedia</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">/myjobs</h3>
                <p className="text-sm text-gray-600 mt-1">Lihat job yang ditugaskan kepada Anda</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">/ambil [job_id]</h3>
                <p className="text-sm text-gray-600 mt-1">Ambil/terima job</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">/mulai [job_id]</h3>
                <p className="text-sm text-gray-600 mt-1">Mulai mengerjakan job</p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">/selesai [job_id]</h3>
                <p className="text-sm text-gray-600 mt-1">Tandai job sebagai selesai</p>
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Konfigurasi WhatsApp</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm font-medium text-gray-700">Sesi WhatsApp</span>
                <span className="text-sm text-gray-500">Terhubung ✓</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm font-medium text-gray-700">Nomor Bot</span>
                <span className="text-sm text-gray-500">6282229261247 ✓</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm font-medium text-gray-700">Antrian Pesan</span>
                <span className="text-sm text-gray-500">Aktif ✓</span>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
