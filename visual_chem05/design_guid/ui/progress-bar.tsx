'use client';

import { useState, useCallback } from 'react';
import { COLORS, RADIUS } from '@/styles/tokens';

interface ProgressData {
  progress: number;
  message: string;
  data?: number[];
  error?: string;
}

interface UsePdfDownloadOptions {
  onSuccess?: (blob: Blob, filename: string) => void;
  onError?: (error: string) => void;
}

export function usePdfDownload(options: UsePdfDownloadOptions = {}) {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (url: string, filename: string, data?: object) => {
    if (isDownloading) return;

    setIsDownloading(true);
    setProgress(0);
    setStatusMessage('准备下载...');
    setError(null);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let receivedData: number[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码并处理 SSE 格式
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: ProgressData = JSON.parse(line.slice(6));

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.data) {
                // 收到文件数据，下载完成
                receivedData = data.data;
                setProgress(100);
                setStatusMessage('下载完成！');

                const uint8Array = new Uint8Array(receivedData);
                const blob = new Blob([uint8Array], { type: 'application/pdf' });

                // 触发下载
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);

                options.onSuccess?.(blob, filename);
              } else {
                // 更新进度
                setProgress(data.progress);
                setStatusMessage(data.message);
              }
            } catch (e) {
              // 忽略解析错误，继续处理下一行
            }
          }
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || '下载失败';
      setError(errorMessage);
      setStatusMessage('下载失败');
      options.onError?.(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, options]);

  const reset = useCallback(() => {
    setProgress(0);
    setStatusMessage('');
    setError(null);
    setIsDownloading(false);
  }, []);

  return {
    progress,
    statusMessage,
    isDownloading,
    error,
    download,
    reset,
  };
}

// 进度条展示组件
interface ProgressBarProps {
  progress: number;
  status: string;
  isDownloading: boolean;
  error: string | null;
}

export function ProgressBar({ progress, status, isDownloading, error }: ProgressBarProps) {
  if (!isDownloading && !error && progress === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-2 p-2 text-sm" style={{ backgroundColor: COLORS.errorLight, color: COLORS.error, borderRadius: RADIUS.sm }}>
          {error}
        </div>
      )}

      {isDownloading && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex-1 h-2 overflow-hidden"
              style={{ backgroundColor: COLORS.bgMuted, borderRadius: RADIUS.full }}
            >
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%`, backgroundColor: COLORS.primary }}
              />
            </div>
            <span className="text-sm min-w-[60px] text-right" style={{ color: COLORS.textSecondary }}>
              {progress}%
            </span>
          </div>
          <div className="text-sm animate-pulse" style={{ color: COLORS.textMuted }}>
            {status}
          </div>
        </>
      )}

      {!isDownloading && progress === 100 && (
        <div className="text-sm" style={{ color: COLORS.success }}>
          ✓ {status}
        </div>
      )}
    </div>
  );
}
