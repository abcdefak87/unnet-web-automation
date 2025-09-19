import React from 'react';
import Head from 'next/head';
import { Search, Home, ArrowLeft } from 'lucide-react';

const Custom404: React.FC = () => {
  return (
    <>
      <Head>
        <title>404 - Halaman Tidak Ditemukan | ISP Management System</title>
        <meta name="description" content="Halaman yang Anda cari tidak ditemukan." />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <div className="card-body space-y-6">
              {/* 404 Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <Search className="h-10 w-10 text-blue-600" />
                </div>
              </div>
              
              {/* 404 Number */}
              <div className="text-6xl font-bold text-blue-600">
                404
              </div>
              
              {/* Error Message */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  Halaman Tidak Ditemukan
                </h1>
                <p className="text-gray-600">
                  Maaf, halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="btn btn-secondary inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </button>
                
                <button
                  onClick={() => window.location.href = '/'}
                  className="btn btn-primary inline-flex items-center justify-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Beranda
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Custom404;
