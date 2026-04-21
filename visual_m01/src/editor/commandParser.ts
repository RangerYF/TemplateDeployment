import { useEntityStore } from './store/entityStore';
import { useHistoryStore } from './store/historyStore';
import { CreateEntityCommand } from './commands/createEntity';
import { createCrossSectionFromPoints } from './crossSectionHelper';
import type { PointProperties } from './entities/types';

// ─── 解析结果类型 ───

interface SegmentCommand {
  type: 'segment';
  labels: [string, string];
}

interface CrossSectionCommand {
  type: 'crossSection';
  labels: string[];
}

interface ErrorCommand {
  type: 'error';
  message: string;
}

type ParsedCommand = SegmentCommand | CrossSectionCommand | ErrorCommand;

// ─── 执行结果 ───

interface CommandResult {
  success: boolean;
  message: string;
}

// ─── 解析 ───

export function parseTextCommand(input: string, toolId: string): ParsedCommand {
  const cleaned = input.replace(/\s+/g, '').toUpperCase();

  if (cleaned.length === 0) {
    return { type: 'error', message: '请输入点名' };
  }

  // 拆分为点名：字母+可选数字，如 "A1B1C" → ["A1", "B1", "C"]
  const labels = cleaned.match(/[A-Z]\d*/g);

  if (!labels || labels.join('') !== cleaned) {
    return { type: 'error', message: '请输入点名，如 AB 或 A1B1' };
  }

  // 检查重复
  const unique = new Set(labels);
  if (unique.size !== labels.length) {
    return { type: 'error', message: '点名不能重复' };
  }

  if (toolId === 'drawSegment') {
    if (labels.length !== 2) {
      return { type: 'error', message: '画线段需要输入2个点名，如 AB' };
    }
    return { type: 'segment', labels: [labels[0], labels[1]] };
  }

  if (toolId === 'crossSection') {
    if (labels.length < 3) {
      return { type: 'error', message: '创建截面至少需要3个点名，如 ABC' };
    }
    return { type: 'crossSection', labels };
  }

  return { type: 'error', message: '当前工具不支持文本指令' };
}

// ─── 执行 ───

export function executeTextCommand(parsed: ParsedCommand): CommandResult {
  if (parsed.type === 'error') {
    return { success: false, message: parsed.message };
  }

  const store = useEntityStore.getState();

  // 查找所有点
  const pointMap = store.findPointsByLabels(parsed.labels);
  const missing: string[] = [];
  for (const [label, entity] of pointMap) {
    if (!entity) missing.push(label);
  }
  if (missing.length > 0) {
    return { success: false, message: `未找到点 ${missing.join('、')}` };
  }

  if (parsed.type === 'segment') {
    const [labelA, labelB] = parsed.labels;
    const pointA = pointMap.get(labelA)!;
    const pointB = pointMap.get(labelB)!;

    // 检查线段是否已存在
    const existing = store.findSegmentByPoints(pointA.id, pointB.id);
    if (existing) {
      return { success: false, message: `线段 ${labelA}${labelB} 已存在` };
    }

    const geometryId = (pointA.properties as PointProperties).geometryId;

    const command = new CreateEntityCommand('segment', {
      builtIn: false,
      geometryId,
      startPointId: pointA.id,
      endPointId: pointB.id,
      style: { color: '#ff0000', dashed: false },
    });

    useHistoryStore.getState().execute(command);
    return { success: true, message: `已创建线段 ${labelA}${labelB}` };
  }

  if (parsed.type === 'crossSection') {
    const pointIds = parsed.labels.map((label) => pointMap.get(label)!.id);
    const firstPoint = pointMap.get(parsed.labels[0])!;
    const geometryId = (firstPoint.properties as PointProperties).geometryId;

    return createCrossSectionFromPoints(geometryId, pointIds);
  }

  return { success: false, message: '未知指令类型' };
}
