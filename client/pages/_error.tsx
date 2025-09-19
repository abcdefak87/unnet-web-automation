import React from 'react';
import { NextPageContext } from 'next';
import Head from 'next/head';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorProps {
  statusCode?: number;
  hasGetInitialPropsRun?: boolean;
  err?: Error;
}

const Error = ({ statusCode, hasGetInitialPropsRun, err }: ErrorProps) => {
  const getErrorMessage = () => {
    if (statusCode === 404) {
      return {
        title: 'Halaman Tidak Ditemukan',
        message: 'Halaman yang Anda cari tidak ditemukan.',
        icon: '🔍'
      };
    }
    
    if (statusCode === 500) {
      return {
        title: 'Kesalahan Server',
        message: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
        icon: '⚠️'
      };
    }
    
    return {
      title: 'Terjadi Kesalahan',
      message: 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.',
      icon: '❌'
    };
  };

  const errorInfo = getErrorMessage();

  return (
    <>
      <Head>
        <title>{errorInfo.title} - Sistem Manajemen ISP</title>
        <meta name="description" content="Halaman error untuk Sistem Manajemen ISP" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/40 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="card-body space-y-6">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-10 w-10 text-red-600" />
                </div>
              </div>
              
              {/* Error Code */}
              {statusCode && (
                <div className="text-6xl font-bold text-red-600">
                  {statusCode}
                </div>
              )}
              
              {/* Error Message */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {errorInfo.title}
                </h1>
                <p className="text-gray-600">
                  {errorInfo.message}
                </p>
              </div>
              
              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && err && (
                <div className="bg-gray-100 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-gray-900 mb-2">Error Details:</h3>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {err.message}
                  </pre>
                  {err.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-gray-600">
                        Stack Trace
                      </summary>
                      <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">
                        {err.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="btn btn-primary inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Muat Ulang
                </button>
                
                <button
                  onClick={() => window.location.href = '/'}
                  className="btn btn-secondary inline-flex items-center justify-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Kembali ke Beranda
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode, hasGetInitialPropsRun: true, err };
};

export default Error;
