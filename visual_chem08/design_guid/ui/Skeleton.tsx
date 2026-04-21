'use client';

import { motion } from 'framer-motion';
import { COLORS } from '@/styles';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

/**
 * Skeleton component with shimmer animation effect
 * Used for loading states to indicate content is being fetched
 */
export function Skeleton({
  className = '',
  width,
  height,
  borderRadius = 8,
}: SkeletonProps) {
  return (
    <motion.div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: COLORS.light,
      }}
      initial={{ opacity: 0.5 }}
      animate={{
        backgroundColor: [
          COLORS.light,
          COLORS.lightAlt,
          COLORS.light,
        ],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/**
 * Shimmer effect overlay for skeleton components
 * Creates the diagonal gradient shimmer effect
 */
export function ShimmerOverlay({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        borderRadius: 'inherit',
      }}
    >
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '200%',
          height: '100%',
          background: `linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.4),
            transparent
          )`,
        }}
        animate={{
          transform: ['translateX(-50%)', 'translateX(50%)'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

/**
 * Skeleton card with shimmer animation
 * Used for loading card placeholders
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <ShimmerOverlay />
      {/* Title line */}
      <Skeleton height={24} width="60%" className="mb-4" />
      {/* Content lines */}
      <Skeleton height={16} width="100%" className="mb-2" />
      <Skeleton height={16} width="80%" className="mb-2" />
      <Skeleton height={16} width="90%" className="mb-4" />
      {/* Button placeholder */}
      <Skeleton height={40} width={120} borderRadius={8} />
    </div>
  );
}

/**
 * Skeleton text lines
 */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ['100%', '80%', '90%'];
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          height={16}
          width={widths[idx] || '100%'}
          className="mb-2"
        />
      ))}
    </div>
  );
}
