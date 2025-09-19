/**
 * Development Tools Component
 * Provides API testing and debugging utilities for development
 * Only available in development mode
 */

import React, { useState } from 'react';
import { devAPI, whatsappAPI, monitoringAPI } from '../lib/api';

interface DevToolsProps {
  className?: string;
}

const DevTools: React.FC<DevToolsProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleTestAllAPIs = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    // Capture console output
    const originalLog = console.log;
    const originalGroup = console.group;
    const originalGroupEnd = console.groupEnd;
    const originalError = console.error;
    
    const logs: string[] = [];
    
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    console.group = (...args) => {
      logs.push(`📁 ${args.join(' ')}`);
      originalGroup(...args);
    };
    
    console.groupEnd = () => {
      logs.push('📁 End Group');
      originalGroupEnd();
    };
    
    console.error = (...args) => {
      logs.push(`❌ ${args.join(' ')}`);
      originalError(...args);
    };

    try {
      await devAPI.testAllEndpoints();
      setTestResults(logs);
    } catch (error) {
      setTestResults([...logs, `❌ Error: ${error}`]);
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.group = originalGroup;
      console.groupEnd = originalGroupEnd;
      console.error = originalError;
      setIsLoading(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setIsLoading(true);
    try {
      const response = await whatsappAPI.getStatus();
      setTestResults([`✅ WhatsApp Status: ${JSON.stringify(response.data, null, 2)}`]);
    } catch (error) {
      setTestResults([`❌ WhatsApp Test Error: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestMonitoring = async () => {
    setIsLoading(true);
    try {
      const response = await monitoringAPI.getSystemStats();
      setTestResults([`✅ System Stats: ${JSON.stringify(response.data, null, 2)}`]);
    } catch (error) {
      setTestResults([`❌ Monitoring Test Error: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestMessage = async () => {
    const phone = prompt('Masukkan nomor telepon (contoh: 6281234567890):');
    if (!phone) return;

    setIsLoading(true);
    try {
      const response = await whatsappAPI.sendTestMessage({
        phone,
        message: 'Test message dari Development Tools'
      });
      setTestResults([`✅ Test Message Sent: ${JSON.stringify(response.data, null, 2)}`]);
    } catch (error) {
      setTestResults([`❌ Send Test Message Error: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Development Tools"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Dev Tools Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white border border-gray-300 rounded-lg shadow-xl w-96 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">🛠️ Development Tools</h3>
            <p className="text-sm text-gray-600">API Testing & Debugging</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Test Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleTestAllAPIs}
                disabled={isLoading}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded transition-colors"
              >
                {isLoading ? '⏳' : '🧪'} Test All APIs
              </button>
              
              <button
                onClick={handleTestWhatsApp}
                disabled={isLoading}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded transition-colors"
              >
                {isLoading ? '⏳' : '📱'} Test WhatsApp
              </button>
              
              <button
                onClick={handleTestMonitoring}
                disabled={isLoading}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded transition-colors"
              >
                {isLoading ? '⏳' : '📊'} Test Monitoring
              </button>
              
              <button
                onClick={handleSendTestMessage}
                disabled={isLoading}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm rounded transition-colors"
              >
                {isLoading ? '⏳' : '📤'} Send Test Message
              </button>
            </div>

            {/* Results */}
            {testResults.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Test Results:</h4>
                <div className="bg-gray-100 p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div key={index} className="mb-1">
                      {result}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setTestResults([])}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear Results
                </button>
              </div>
            )}
          </div>

          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              💡 Hanya tersedia dalam mode development
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevTools;
