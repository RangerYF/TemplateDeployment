export { inspectorRegistry, registerInspector } from './registry';
export { InspectorPanel } from './InspectorPanel';

// 触发 Inspector 自注册（side-effect import）
import './CoordSystemInspector';
import './CircumSphereInspector';
import './CircumCircleInspector';
import './GeometryInspector';
import './PointInspector';
import './SegmentInspector';
import './FaceInspector';
import './AngleMeasurementInspector';
import './DistanceMeasurementInspector';
