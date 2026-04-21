import type { CrystalCategory } from '@/engine/types';

export interface CategoryInfo {
  id: CrystalCategory;
  name: string;
  description: string;
  bondTypes: string[];
  icon: string; // lucide icon name
}

export const CRYSTAL_CATEGORIES: CategoryInfo[] = [
  {
    id: 'ionic',
    name: '离子晶体',
    description:
      '由阴阳离子通过离子键结合而成的晶体。具有较高的熔沸点，硬度较大但脆性明显，固态不导电但熔融或溶于水后可导电。',
    bondTypes: ['离子键'],
    icon: 'Zap',
  },
  {
    id: 'atomic',
    name: '原子晶体',
    description:
      '所有原子间以共价键结合形成空间网状结构的晶体。熔沸点极高，硬度极大，不导电（硅除外为半导体）。',
    bondTypes: ['共价键（σ键）'],
    icon: 'Diamond',
  },
  {
    id: 'metallic',
    name: '金属晶体',
    description:
      '由金属阳离子和自由电子通过金属键结合而成的晶体。具有良好的导电性、导热性和延展性，熔沸点差异较大。',
    bondTypes: ['金属键'],
    icon: 'CircleDot',
  },
  {
    id: 'molecular',
    name: '分子晶体',
    description:
      '由分子通过分子间作用力（范德华力、氢键）结合而成的晶体。熔沸点较低，硬度较小，一般不导电。',
    bondTypes: ['范德华力', '氢键', '分子内共价键'],
    icon: 'Snowflake',
  },
  {
    id: 'layered',
    name: '层状结构',
    description:
      '层内原子以共价键或金属键强连接，层间以范德华力弱连接的特殊结构。兼具共价晶体和分子晶体的特性，如石墨层内导电而层间绝缘。',
    bondTypes: ['层内共价键/金属键', '层间范德华力'],
    icon: 'Layers',
  },
];
