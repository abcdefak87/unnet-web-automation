import { useEffect, useState } from 'react'
import { useRealtime } from '../contexts/RealtimeContext'
import { api } from '../lib/api'

interface UseRealtimeDataOptions {
  endpoint: string
  initialData?: any[]
  dependencies?: any[]
}

export function useRealtimeData<T>({ 
  endpoint, 
  initialData = [], 
  dependencies = [] 
}: UseRealtimeDataOptions) {
  const [data, setData] = useState<T[]>(initialData)
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useRealtime()

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(endpoint)
        
        // Handle different response structures
        const responseData = response.data?.data || response.data
        const dataArray = Array.isArray(responseData) 
          ? responseData 
          : responseData?.jobs || responseData?.customers || responseData?.items || []
        const totalValue = Array.isArray(responseData)
          ? responseData.length
          : (responseData?.total ?? (Array.isArray(dataArray) ? dataArray.length : 0))

        setData(dataArray)
        setTotal(totalValue)
    } catch (err: any) {
      console.error(`Failed to fetch data from ${endpoint}:`, err)
      setError(err.response?.data?.error || 'Failed to fetch data')
    } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [endpoint, ...dependencies]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update data when real-time events occur
  const updateData = (updatedItem: T, action: string) => {
    setData(prevData => {
      switch (action) {
        case 'created':
        case 'CREATED':
          return [updatedItem, ...prevData]
        
        case 'updated':
        case 'UPDATED':
        case 'assigned':
        case 'ASSIGNED':
        case 'started':
        case 'STARTED':
        case 'completed':
        case 'COMPLETED':
        case 'approved':
        case 'APPROVED':
        case 'rejected':
        case 'REJECTED':
          return prevData.map(item => 
            (item as any).id === (updatedItem as any).id ? updatedItem : item
          )
        
        case 'deleted':
        case 'DELETED':
          return prevData.filter(item => 
            (item as any).id !== (updatedItem as any).id
          )
        
        default:
          return prevData
      }
    })
  }

  const refetch = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(endpoint)
      
      const responseData = response.data?.data || response.data
      const dataArray = Array.isArray(responseData) 
        ? responseData 
        : responseData?.jobs || responseData?.customers || responseData?.items || []
      const totalValue = Array.isArray(responseData)
        ? responseData.length
        : (responseData?.total ?? (Array.isArray(dataArray) ? dataArray.length : 0))

      setData(dataArray)
      setTotal(totalValue)
    } catch (err: any) {
      console.error(`Failed to refetch data from ${endpoint}:`, err)
      setError(err.response?.data?.error || 'Failed to refetch data')
    } finally {
      setLoading(false)
    }
  }

  return {
    data,
    total,
    loading,
    error,
    isConnected,
    updateData,
    refetch,
    setData
  }
}
