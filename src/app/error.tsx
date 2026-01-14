'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry에 에러 전송
    Sentry.captureException(error);
    // 에러 로깅 (콘솔)
    console.error('Page Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          오류가 발생했습니다
        </h2>
        
        <p className="text-gray-600 mb-6">
          페이지를 불러오는 중 문제가 발생했습니다.<br />
          잠시 후 다시 시도해주세요.
        </p>

        {/* 에러 메시지 (개발용) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 rounded p-3 mb-6 text-left">
            <p className="text-xs text-gray-500 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <RefreshCw size={18} />
            다시 시도
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            <Home size={18} />
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}