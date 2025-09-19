'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Phone, 
  QrCode, 
  MessageCircle, 
  Users, 
  Send, 
  RefreshCw, 
  Power,
  Check,
  AlertTriangle
} from 'lucide-react';

interface WhatsAppStatus {
  isConnected: boolean;
  phoneNumber?: string;
  qrCode?: string;
  lastSeen?: string;
}

interface WhatsAppManagerProps {
  className?: string;
}

const WhatsAppManager: React.FC<WhatsAppManagerProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<WhatsAppStatus>({
    isConnected: false
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  // Fetch WhatsApp status
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/whatsapp/status');
      const data = await response.json();
      
      setStatus({
        isConnected: data.connected || false,
        phoneNumber: data.phoneNumber,
        qrCode: data.qrCode,
        lastSeen: data.lastSeen
      });
    } catch (error) {
      console.error('Failed to fetch WhatsApp status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize WhatsApp connection
  const initializeWhatsApp = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/whatsapp/initialize', {
        method: 'POST'
      });
      
      if (response.ok) {
        await fetchStatus();
      }
    } catch (error) {
      console.error('Failed to initialize WhatsApp:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Send broadcast message
  const sendBroadcast = async () => {
    if (!message.trim() || selectedCustomers.length === 0) {
      alert('Silakan masukkan pesan dan pilih pelanggan');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          customerIds: selectedCustomers
        })
      });

      if (response.ok) {
        alert('Pesan broadcast berhasil dikirim!');
        setMessage('');
        setSelectedCustomers([]);
      } else {
        alert('Gagal mengirim pesan broadcast');
      }
    } catch (error) {
      console.error('Failed to send broadcast:', error);
      alert('Gagal mengirim pesan broadcast');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Status Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Status Bot WhatsApp
            </div>
            <span className={`badge ${status.isConnected ? 'badge-success' : 'badge-secondary'}`}>
              {status.isConnected ? 'Terhubung' : 'Terputus'}
            </span>
          </h3>
        </div>
        <div className="card-content space-y-4">
          {status.isConnected ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Nomor WhatsApp:</span>
                <span className="font-mono">{status.phoneNumber || 'Memuat...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="h-4 w-4" />
                  Terhubung
                </span>
              </div>
              {status.lastSeen && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Terakhir Dilihat:</span>
                  <span className="text-sm text-gray-500">{status.lastSeen}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <p className="text-gray-600">Bot WhatsApp tidak terhubung</p>
              </div>
              
              {status.qrCode && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Pindai QR Code dengan WhatsApp:</p>
                  <div className="flex justify-center">
                    <Image 
                      src={status.qrCode} 
                      alt="QR Code WhatsApp" 
                      width={256}
                      height={256}
                      className="border rounded-lg"
                      priority
                    />
                  </div>
                </div>
              )}
              
              <button
                onClick={initializeWhatsApp}
                disabled={isLoading}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                Inisialisasi Bot WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Management Section */}
      {status.isConnected && (
        <div className="space-y-4">
          <div className="tabs-list">
            <button className="tab-trigger active">Broadcast</button>
            <button className="tab-trigger">Pesan</button>
            <button className="tab-trigger">Pengaturan</button>
          </div>

          <div className="tab-content space-y-4">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Kirim Pesan Broadcast</h3>
              </div>
              <div className="card-content space-y-4">
                <div>
                  <label className="form-label">Pesan</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Masukkan pesan broadcast Anda..."
                    className="form-textarea"
                    rows={4}
                  />
                </div>
                
                <div>
                  <label className="form-label">Pilih Pelanggan</label>
                  <div className="text-sm text-gray-600 mb-2">
                    Fitur pemilihan pelanggan akan diimplementasikan di sini
                  </div>
                </div>
                
                <button
                  onClick={sendBroadcast}
                  disabled={isLoading || !message.trim()}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Kirim Broadcast
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppManager;