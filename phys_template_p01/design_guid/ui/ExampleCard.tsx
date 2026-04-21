"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import {
  CARD_STYLES,
  DifficultyBadge,
  getDifficultyStyle,
  type DifficultyLevel,
} from "@/components/ui/card";

// ============================================
// 示例卡片组件 - ExampleCard
// ============================================
// 展示设计规范的应用示例

interface ExampleCardProps {
  title: string;
  description?: string;
  difficulty?: DifficultyLevel;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ExampleCard({
  title,
  description,
  difficulty,
  children,
  onClick,
  className,
}: ExampleCardProps) {
  return (
    <div
      className={cn(
        // SYXMA Card 规范: bg white, border #E5E7EB, border-radius 18px
        "bg-white border border-[#E5E7EB] rounded-[18px] p-6",
        // Hover 效果: border-color → borderStrong + box-shadow
        "transition-[border-color,box-shadow] duration-[0.12s]",
        onClick && "cursor-pointer hover:border-[#D1D1CF] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        className
      )}
      onClick={onClick}
    >
      {/* 头部区域 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {title && (
            <h3 className="text-lg font-semibold text-[#1A1A2E] mb-1">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-[#595959]">{description}</p>
          )}
        </div>
        {difficulty && (
          <DifficultyBadge level={difficulty} />
        )}
      </div>

      {/* 内容区域 */}
      {children && (
        <div className={CARD_STYLES.spacing.gap}>
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================
// 示例：使用卡片设计规范的多种用法
// ============================================

/**
 * 使用示例:
 *
 * // 1. 基础卡片
 * <ExampleCard
 *   title="卡片标题"
 *   description="卡片描述"
 *   difficulty={2}
 * >
 *   <p>卡片内容</p>
 * </ExampleCard>
 *
 * // 2. 直接使用 DifficultyBadge
 * <DifficultyBadge level={3} />
 * <DifficultyBadge level={4} showLabel={false} />
 *
 * // 3. 使用样式常量
 * <div className={CARD_STYLES.base}>
 *   自定义内容
 * </div>
 *
 * // 4. 使用 getDifficultyStyle 获取样式
 * const style = getDifficultyStyle(5);
 * <div style={{ backgroundColor: style.bg, color: style.color }}>
 *   {style.label}
 * </div>
 */

// ============================================
// 示例：简化版问题卡片组件
// ============================================

interface ProblemCardSimpleProps {
  questionNumber: string;
  questionText: string;
  difficulty: DifficultyLevel;
  knowledgePoints?: string[];
  onClick?: () => void;
}

export function ProblemCardSimple({
  questionNumber,
  questionText,
  difficulty,
  knowledgePoints = [],
  onClick,
}: ProblemCardSimpleProps) {
  return (
    <div
      className={cn(
        // SYXMA Card 规范: bg white, border #E5E7EB, border-radius 18px
        "bg-white border border-[#E5E7EB] rounded-[18px] p-6",
        // Hover 效果: border-color → borderStrong + box-shadow
        "transition-[border-color,box-shadow] duration-[0.12s] cursor-pointer hover:border-[#D1D1CF] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      )}
      onClick={onClick}
    >
      {/* 头部：题号 + 难度标签 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl font-bold text-[#1A1A2E]">
          {questionNumber}
        </span>
        <DifficultyBadge level={difficulty} />
      </div>

      {/* 题目内容 */}
      <p className="text-[#1A1A2E] mb-4 line-clamp-3">{questionText}</p>

      {/* 知识点标签 - SYXMA tag-gray 样式 */}
      {knowledgePoints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {knowledgePoints.map((kp, index) => (
            <span
              key={index}
              className="px-2 py-0.5 text-xs bg-[#F5F5F7] text-[#6B7280] rounded-full"
            >
              {kp}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// 示例：知识卡片组件
// ============================================

interface KnowledgeCardProps {
  title: string;
  category: string;
  difficulty: DifficultyLevel;
  children: React.ReactNode;
  onClick?: () => void;
}

export function KnowledgeCard({
  title,
  category,
  difficulty,
  children,
  onClick,
}: KnowledgeCardProps) {
  return (
    <div
      className={cn(
        // SYXMA Card 规范: bg white, border #E5E7EB, border-radius 18px
        "bg-white border border-[#E5E7EB] rounded-[18px] p-6",
        // Hover 效果: border-color → borderStrong + box-shadow
        "transition-[border-color,box-shadow] duration-[0.12s]",
        onClick && "cursor-pointer hover:border-[#D1D1CF] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      )}
      onClick={onClick}
    >
      {/* 分类标签 - SYXMA tag-gray 样式 */}
      <span className="inline-block px-2 py-0.5 text-xs bg-[#F5F5F7] text-[#6B7280] rounded-full mb-3">
        {category}
      </span>

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">
        {title}
      </h3>

      {/* 难度 */}
      <div className="mb-4">
        <DifficultyBadge level={difficulty} size="sm" />
      </div>

      {/* 内容 */}
      <div className="text-sm text-[#6B7280]">
        {children}
      </div>
    </div>
  );
}

export default ExampleCard;
