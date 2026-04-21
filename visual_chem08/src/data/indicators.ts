export interface Indicator {
  id: string;
  name: string;
  pHRange: [number, number];
  colors: string[];
  colorLabels: string[];
  canUseTitration: boolean;
  gradeLevel: string;
}

export const INDICATORS: Indicator[] = [
  {
    id: 'litmus',
    name: '石蕊',
    pHRange: [5.0, 8.0],
    colors: ['#DC2626', '#8B5CF6', '#2563EB'],
    colorLabels: ['红', '紫', '蓝'],
    canUseTitration: false,
    gradeLevel: '初中',
  },
  {
    id: 'phenolphthalein',
    name: '酚酞',
    pHRange: [8.2, 10.0],
    colors: ['rgba(200,200,200,0.3)', '#EC4899'],
    colorLabels: ['无色', '粉红'],
    canUseTitration: true,
    gradeLevel: '初中',
  },
  {
    id: 'methylOrange',
    name: '甲基橙',
    pHRange: [3.1, 4.4],
    colors: ['#DC2626', '#F97316', '#EAB308'],
    colorLabels: ['红', '橙', '黄'],
    canUseTitration: true,
    gradeLevel: '高中必修',
  },
  {
    id: 'methylRed',
    name: '甲基红',
    pHRange: [4.4, 6.2],
    colors: ['#DC2626', '#F97316', '#EAB308'],
    colorLabels: ['红', '橙', '黄'],
    canUseTitration: true,
    gradeLevel: '高中选修',
  },
];
