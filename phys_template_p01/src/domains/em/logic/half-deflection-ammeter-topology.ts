import type { Entity, Relation } from '@/core/types';

type PortSide = 'top' | 'bottom' | 'left' | 'right';

export interface HalfDeflectionAmmeterTopology {
  leftNodeName: 'A_left';
  rightNodeName: 'A_right';
  sourceToMainSwitch: boolean;
  mainSwitchToMeterLeft: boolean;
  meterLeftToBranch: boolean;
  branchSeries: boolean;
  branchToMeterRight: boolean;
  meterRightToSource: boolean;
  mainLoopValid: boolean;
  branchAcrossMeter: boolean;
  valid: boolean;
  note: string;
}

function getRelationPort(
  relation: Relation,
  side: 'source' | 'target',
): PortSide | undefined {
  const key = side === 'source' ? 'sourcePort' : 'targetPort';
  const value = relation.properties[key] as string | undefined;
  if (value === 'top' || value === 'bottom' || value === 'left' || value === 'right') {
    return value;
  }
  return undefined;
}

function hasConnection(
  relations: Relation[],
  firstEntityId: string,
  firstPort: PortSide,
  secondEntityId: string,
  secondPort: PortSide,
): boolean {
  return relations.some((relation) => {
    if (relation.type !== 'connection') return false;

    const sourcePort = getRelationPort(relation, 'source');
    const targetPort = getRelationPort(relation, 'target');

    if (
      relation.sourceEntityId === firstEntityId &&
      relation.targetEntityId === secondEntityId &&
      sourcePort === firstPort &&
      targetPort === secondPort
    ) {
      return true;
    }

    return (
      relation.sourceEntityId === secondEntityId &&
      relation.targetEntityId === firstEntityId &&
      sourcePort === secondPort &&
      targetPort === firstPort
    );
  });
}

export function inspectHalfDeflectionAmmeterTopology(params: {
  relations: Relation[];
  source: Entity;
  mainSwitch: Entity;
  meter: Entity;
  halfSwitch: Entity;
  halfResistor: Entity;
}): HalfDeflectionAmmeterTopology {
  const { relations, source, mainSwitch, meter, halfSwitch, halfResistor } = params;

  const sourceToMainSwitch = hasConnection(relations, source.id, 'right', mainSwitch.id, 'left');
  const mainSwitchToMeterLeft = hasConnection(relations, mainSwitch.id, 'right', meter.id, 'left');
  const meterLeftToBranch = hasConnection(relations, meter.id, 'left', halfSwitch.id, 'left');
  const branchSeries = hasConnection(relations, halfSwitch.id, 'right', halfResistor.id, 'left');
  const branchToMeterRight = hasConnection(relations, halfResistor.id, 'right', meter.id, 'right');
  const meterRightToSource = hasConnection(relations, meter.id, 'right', source.id, 'left');

  const mainLoopValid = sourceToMainSwitch && mainSwitchToMeterLeft && meterRightToSource;
  const branchAcrossMeter = meterLeftToBranch && branchSeries && branchToMeterRight;
  const valid = mainLoopValid && branchAcrossMeter;

  return {
    leftNodeName: 'A_left',
    rightNodeName: 'A_right',
    sourceToMainSwitch,
    mainSwitchToMeterLeft,
    meterLeftToBranch,
    branchSeries,
    branchToMeterRight,
    meterRightToSource,
    mainLoopValid,
    branchAcrossMeter,
    valid,
    note: branchAcrossMeter
      ? "S'+R' 已跨接在 A_left 与 A_right 两节点之间"
      : "S'+R' 未同时连接 A_left 与 A_right，当前不会形成并联分流",
  };
}
