export type ElementCategory =

  | "alkali-metal"

  | "alkaline-earth-metal"

  | "transition-metal"

  | "post-transition-metal"

  | "metalloid"

  | "nonmetal"

  | "halogen"

  | "noble-gas"

  | "lanthanide"

  | "actinide";



export interface ChemicalElement {

  // 基本信息

  atomicNumber: number;

  symbol: string;

  nameZh: string;

  nameEn: string;

  atomicMass: string;

  category: ElementCategory;

  period: number;

  group: number | null;

  groupLabel: string;

  // 物理性质

  stateAtRoomTemp: string;

  density: string;

  meltingPoint: number;

  boilingPoint: number;

  electronegativity: number | null;

  // 化学信息

  electronConfiguration: string;

  oxidationStates: string;

  // 详情面板富文本

  chemicalProperties: string;

  history: string;

  applications: string;

  funFact: string;

  educationalLinks: string[];

  /** 存在同素异形体时，说明当前物理数据对应的是哪种形态 */
  allotropeNote?: string;

}



export const elements = ([

  {

    atomicNumber: 1,

    symbol: "H",

    nameZh: "氢",

    nameEn: "Hydrogen",

    atomicMass: "1.008",

    category: "nonmetal",

    period: 1,

    group: 1,

    groupLabel: "IA",

    stateAtRoomTemp: "无色无味气体",

    density: "0.0899 g/L",

    meltingPoint: -259.16,

    boilingPoint: -252.87,

    electronegativity: 2.20,

    electronConfiguration: "1s\u00B9",

    oxidationStates: "+1, -1",

    chemicalProperties: "氢气是最轻的气体，可燃但不助燃。与氧气混合点燃会爆炸（爆炸极限 4%-75%），纯净氢气安静燃烧产生淡蓝色火焰。氢气具有还原性，高温下可还原氧化铜等金属氧化物。",

    history: "1766 年英国化学家卡文迪许首次制备纯净氢气，称之为可燃空气。1783 年拉瓦锡将其命名为 Hydrogen（希腊语产生水的元素）。",

    applications: "合成氨工业原料、火箭燃料、氢燃料电池、金属冶炼的还原剂、石油化工加氢。",

    funFact: "氢是宇宙中含量最丰富的元素，占宇宙可见物质质量的约 75%。太阳的能量来源就是氢的核聚变反应。",

    educationalLinks: [

      "[初中] 氢气的制备与性质（Zn+HCl）",

      "[高中必修] 氢气的还原性、氢能源",

    ],

  },

  {

    atomicNumber: 2,

    symbol: "He",

    nameZh: "氦",

    nameEn: "Helium",

    atomicMass: "4.003",

    category: "noble-gas",

    period: 1,

    group: 18,

    groupLabel: "0族",

    stateAtRoomTemp: "无色无味气体",

    density: "0.1786 g/L",

    meltingPoint: -272.20,

    boilingPoint: -268.93,

    electronegativity: null,

    electronConfiguration: "1s\u00B2",

    oxidationStates: "0",

    chemicalProperties: "氦是化学性质最稳定的元素之一，在通常条件下不与任何物质反应。其原子最外层为满的 1s² 构型，极难失去或获得电子。",

    history: "1868 年法国天文学家让桑和英国天文学家洛克耶在日食观测中通过太阳光谱发现了一条未知的黄色谱线，命名为 Helium（希腊语太阳）。1895 年拉姆齐在地球上的矿物中分离出氦气。",

    applications: "低温超导冷却剂（液氦 4.2K）、飞艇和气球的填充气（不可燃）、深海潜水混合气、半导体制造保护气。",

    funFact: "氦是唯一在常压下无法凝固为固体的元素——即使冷却到绝对零度附近，也需要加压约 25 个大气压才能变成固体。",

    educationalLinks: [

      "[初中] 稀有气体的用途",

      "[高中必修] 原子结构与稳定性",

    ],

  },

  {

    atomicNumber: 3,

    symbol: "Li",

    nameZh: "锂",

    nameEn: "Lithium",

    atomicMass: "6.941",

    category: "alkali-metal",

    period: 2,

    group: 1,

    groupLabel: "IA",

    stateAtRoomTemp: "银白色软金属",

    density: "0.534 g/cm\u00B3",

    meltingPoint: 180.54,

    boilingPoint: 1342,

    electronegativity: 0.98,

    electronConfiguration: "[He] 2s\u00B9",

    oxidationStates: "+1",

    chemicalProperties: "锂是最轻的金属，密度仅为水的一半。能与水缓慢反应生成 LiOH 和 H₂（比 Na 反应温和）。在空气中燃烧生成 Li₂O（不生成过氧化物，这与 Na 不同）。锂的焰色反应为紫红色。",

    history: "1817 年瑞典化学家阿尔费德松在分析透锂长石时发现，由贝采利乌斯命名为 Lithium（希腊语石头）。",

    applications: "锂离子电池（手机、电动车）、锂合金（航空航天轻量化材料）、精神疾病药物（碳酸锂）、核聚变材料。",

    funFact: "锂是密度最小的金属，可以浮在煤油上面。一块锂放入水中会浮在水面上慢慢反应。",

    educationalLinks: [

      "[高中必修] 碱金属性质递变规律的起点",

      "[高中选修] 锂电池原理",

    ],

  },

  {

    atomicNumber: 4,

    symbol: "Be",

    nameZh: "铍",

    nameEn: "Beryllium",

    atomicMass: "9.012",

    category: "alkaline-earth-metal",

    period: 2,

    group: 2,

    groupLabel: "IIA",

    stateAtRoomTemp: "灰白色硬金属",

    density: "1.85 g/cm\u00B3",

    meltingPoint: 1287,

    boilingPoint: 2469,

    electronegativity: null,

    electronConfiguration: "[He] 2s\u00B2",

    oxidationStates: "+2",

    chemicalProperties: "铍是碱土金属中最特殊的一个，化学性质与铝有很多相似之处（对角线规则）。Be(OH)₂ 是两性氢氧化物，BeO 是两性氧化物。铍不与水反应。",

    history: "1798 年法国化学家沃克兰从绿柱石中发现了铍的氧化物，命名来自希腊语 beryllos（绿柱石）。",

    applications: "铍铜合金（弹性材料、不产生火花的工具）、X 射线管窗口材料（对 X 射线透明）、核反应堆中子减速剂。",

    funFact: "铍的化合物有甜味（旧称甜土），但铍及其化合物有剧毒，吸入铍粉尘会导致铍中毒。",

    educationalLinks: [

      "[高中选修] 对角线规则（Li~Mg, Be~Al）",

      "[拓展] 两性氧化物",

    ],

  },

  {

    atomicNumber: 5,

    symbol: "B",

    nameZh: "硼",

    nameEn: "Boron",

    atomicMass: "10.81",

    category: "metalloid",

    period: 2,

    group: 13,

    groupLabel: "IIIA",

    stateAtRoomTemp: "黑色硬质固体",

    density: "2.34 g/cm\u00B3",

    meltingPoint: 2076,

    boilingPoint: 3927,

    electronegativity: 2.04,

    electronConfiguration: "[He] 2s\u00B2 2p\u00B9",

    oxidationStates: "+3",

    chemicalProperties: "硼是缺电子元素，BF₃ 是典型的路易斯酸（有空的 p 轨道可接受孤对电子）。硼的含氧酸（硼酸 H₃BO₃）是很弱的酸。硼砂 Na₂B₄O₇·10H₂O 是重要的硼化合物。",

    history: "1808 年法国化学家盖-吕萨克和泰纳尔以及英国化学家戴维几乎同时独立分离出硼单质。",

    applications: "硼硅酸盐玻璃（耐热玻璃）、硼砂（清洁剂、助焊剂）、含硼钢（硬度高）、核反应堆控制棒（吸收中子能力强）。",

    funFact: "硼的硬度仅次于金刚石和碳化硼，晶体硼是自然界中第二硬的单质。",

    educationalLinks: [

      "[高中选修] BF₃ 的 sp² 杂化和缺电子特性、路易斯酸碱理论",

    ],

  },

  {

    atomicNumber: 6,

    symbol: "C",

    nameZh: "碳",

    nameEn: "Carbon",

    atomicMass: "12.01",

    category: "nonmetal",

    period: 2,

    group: 14,

    groupLabel: "IVA",

    stateAtRoomTemp: "固体（金刚石/石墨/富勒烯等多种同素异形体）",

    density: "2.27 g/cm\u00B3（石墨）",

    meltingPoint: 3550,

    boilingPoint: 3550,

    electronegativity: 2.55,

    electronConfiguration: "[He] 2s\u00B2 2p\u00B2",

    oxidationStates: "+4, +2, -4",

    chemicalProperties: "碳是有机化学的基础元素，能形成极其多样的化合物。碳有多种同素异形体：金刚石（sp³）、石墨（sp²）、富勒烯 C₆₀、石墨烯、碳纳米管等。碳在高温下具有还原性（冶金中用焦炭还原金属氧化物）。CO 有毒，CO₂ 是温室气体。",

    history: "碳自古已知（木炭、金刚石）。1772 年拉瓦锡证明金刚石是碳的一种形态。",

    applications: "钢铁冶金（焦炭）、铅笔（石墨）、钻石珠宝、碳纤维复合材料、活性炭（吸附）、有机化工基础元素。",

    funFact: "自然界已知的化合物中，碳化合物（有机物）的数量超过其他所有元素化合物的总和——目前已知超过 1 亿种有机化合物。",

    educationalLinks: [

      "[初中] 碳的单质（金刚石、石墨）、CO 和 CO₂",

      "[高中必修] 同素异形体、碳的还原性",

      "[高中选修] 有机化学",

    ],

    allotropeNote: "熔点（约 3550 °C）和密度（2.27 g/cm³）以石墨为参考。金刚石密度 3.51 g/cm³，硬度最高；C₆₀（富勒烯）为分子晶体，性质差异显著。",

  },

  {

    atomicNumber: 7,

    symbol: "N",

    nameZh: "氮",

    nameEn: "Nitrogen",

    atomicMass: "14.01",

    category: "nonmetal",

    period: 2,

    group: 15,

    groupLabel: "VA",

    stateAtRoomTemp: "无色无味气体",

    density: "1.251 g/L",

    meltingPoint: -210.00,

    boilingPoint: -195.79,

    electronegativity: 3.04,

    electronConfiguration: "[He] 2s\u00B2 2p\u00B3",

    oxidationStates: "-3, +1, +2, +3, +4, +5",

    chemicalProperties: "N₂ 中的氮氮三键（N≡N）键能极高（945 kJ/mol），因此氮气化学性质很稳定。但在高温高压催化剂条件下可与氢气合成氨（哈伯法）。氮的含氧酸包括 HNO₃（强酸、强氧化性）和 HNO₂（弱酸）。氮的氧化物（NO、NO₂）是重要的大气污染物。",

    history: "1772 年英国化学家卢瑟福发现空气中除去氧气和二氧化碳后剩余的气体不支持燃烧，称为浊气。拉瓦锡命名为 azote（无生命的），后改为 Nitrogen。",

    applications: "合成氨化肥、液氮冷冻保存、食品充氮保鲜、轮胎充氮、超导材料冷却。",

    funFact: "氮气占空气体积的 78%，是大气中含量最高的气体。每次呼吸中大部分吸入和呼出的其实都是氮气。",

    educationalLinks: [

      "[初中] 空气组成（78% N₂）",

      "[高中必修] 合成氨、氮的氧化物、硝酸",

    ],

  },

  {

    atomicNumber: 8,

    symbol: "O",

    nameZh: "氧",

    nameEn: "Oxygen",

    atomicMass: "16.00",

    category: "nonmetal",

    period: 2,

    group: 16,

    groupLabel: "VIA",

    stateAtRoomTemp: "无色无味气体",

    density: "1.429 g/L",

    meltingPoint: -218.79,

    boilingPoint: -182.96,

    electronegativity: 3.44,

    electronConfiguration: "[He] 2s\u00B2 2p\u2074",

    oxidationStates: "-2, -1",

    chemicalProperties: "氧气是强氧化剂，支持燃烧。大多数元素都能与氧直接化合。臭氧（O₃）是氧的同素异形体，有强氧化性。过氧化氢（H₂O₂）中氧为 -1 价。Na₂O₂ 是重要的过氧化物。",

    history: "1774 年英国化学家普利斯特里和瑞典化学家舍勒分别独立制备出氧气。拉瓦锡将其命名为 Oxygen（希腊语产生酸的元素）。",

    applications: "炼钢助燃、医疗供氧、航天氧化剂、臭氧消毒、切割焊接。",

    funFact: "虽然拉瓦锡认为氧是成酸元素，但实际上并非所有含氧化合物都是酸（如 NaOH），也不是所有酸都含氧（如 HCl）。",

    educationalLinks: [

      "[初中] 氧气的制备和性质、空气组成",

      "[高中必修] 氧化还原反应、Na₂O₂",

    ],

    allotropeNote: "物理数据（−218.8 °C 熔点、−183 °C 沸点）均为 O₂。臭氧（O₃）沸点 −112 °C、密度 2.14 g/L，具有强氧化性，为另一种同素异形体。",

  },

  {

    atomicNumber: 9,

    symbol: "F",

    nameZh: "氟",

    nameEn: "Fluorine",

    atomicMass: "19.00",

    category: "halogen",

    period: 2,

    group: 17,

    groupLabel: "VIIA",

    stateAtRoomTemp: "淡黄色气体",

    density: "1.696 g/L",

    meltingPoint: -219.67,

    boilingPoint: -188.11,

    electronegativity: 3.98,

    electronConfiguration: "[He] 2s\u00B2 2p\u2075",

    oxidationStates: "-1",

    chemicalProperties: "氟是电负性最强的元素，也是最强的非金属单质氧化剂。氟气几乎能与所有元素直接化合（除了 He、Ne、Ar）。氟气与水剧烈反应：2F₂ + 2H₂O → 4HF + O₂。HF 是弱酸（与其他氢卤酸不同），但能腐蚀玻璃（SiO₂ + 4HF → SiF₄ + 2H₂O）。",

    history: "1886 年法国化学家莫瓦桑通过电解无水氟化氢首次制备出氟气，为此获得 1906 年诺贝尔化学奖。",

    applications: "含氟牙膏（氟化钠防龋齿）、特氟龙（聚四氟乙烯不粘涂层）、制冷剂、铀浓缩（UF₆）。",

    funFact: "氟气的制备极为困难且危险，莫瓦桑为分离氟气付出了巨大代价——他的身体因长期接触有毒氟化物而受到严重伤害。",

    educationalLinks: [

      "[高中必修] 卤素性质递变、非金属性强弱比较",

      "[高中选修] HF 的特殊性（弱酸、腐蚀玻璃）",

    ],

  },

  {

    atomicNumber: 10,

    symbol: "Ne",

    nameZh: "氖",

    nameEn: "Neon",

    atomicMass: "20.18",

    category: "noble-gas",

    period: 2,

    group: 18,

    groupLabel: "0族",

    stateAtRoomTemp: "无色气体",

    density: "0.9002 g/L",

    meltingPoint: -248.59,

    boilingPoint: -246.08,

    electronegativity: null,

    electronConfiguration: "[He] 2s\u00B2 2p\u2076",

    oxidationStates: "0",

    chemicalProperties: "氖的化学性质极其稳定，至今未发现任何氖的化合物。其最外层 8 电子全充满构型使其极难参与化学反应。",

    history: "1898 年英国化学家拉姆齐和特拉弗斯从液态空气蒸馏残余中发现氖。名称来自希腊语 neon（新的）。",

    applications: "霓虹灯（氖气放电发出橙红色光）、激光器（氦氖激光器）、高压指示灯、冷冻工质。",

    funFact: "霓虹灯这个名字就来自氖元素——虽然现在彩色霓虹灯实际使用多种不同气体，但最经典的橙红色就是氖气的颜色。",

    educationalLinks: [

      "[初中] 稀有气体的性质与用途",

      "[高中必修] 原子结构与化学稳定性",

    ],

  },

  {

    atomicNumber: 11,

    symbol: "Na",

    nameZh: "钠",

    nameEn: "Sodium",

    atomicMass: "22.99",

    category: "alkali-metal",

    period: 3,

    group: 1,

    groupLabel: "IA",

    stateAtRoomTemp: "银白色软金属",

    density: "0.971 g/cm\u00B3",

    meltingPoint: 97.72,

    boilingPoint: 883,

    electronegativity: 0.93,

    electronConfiguration: "[Ne] 3s\u00B9",

    oxidationStates: "+1",

    chemicalProperties: "钠化学性质非常活泼。在空气中迅速被氧化。与水剧烈反应：2Na + 2H₂O → 2NaOH + H₂↑（浮在水面、熔成球、四处游动、发出嘶嘶声）。在空气中燃烧生成淡黄色的 Na₂O₂（过氧化钠），而非 Na₂O。钠的焰色反应为黄色。",

    history: "1807 年英国化学家戴维通过电解熔融氢氧化钠首次制备出钠。名称来自英语 soda（苏打）。",

    applications: "钠蒸气灯（高压钠灯用于路灯照明）、核反应堆冷却剂（液态钠）、有机合成还原剂、Na₂O₂ 用于潜艇供氧。",

    funFact: "钠必须保存在煤油中以隔绝空气和水。如果把一小块钠扔进水里，它会浮在水面上旋转并发出嘶嘶声，甚至可能着火。",

    educationalLinks: [

      "[高中必修] 钠的性质（核心知识点）、Na₂O 与 Na₂O₂ 的对比、钠与水反应实验",

    ],

  },

  {

    atomicNumber: 12,

    symbol: "Mg",

    nameZh: "镁",

    nameEn: "Magnesium",

    atomicMass: "24.31",

    category: "alkaline-earth-metal",

    period: 3,

    group: 2,

    groupLabel: "IIA",

    stateAtRoomTemp: "银白色轻金属",

    density: "1.738 g/cm\u00B3",

    meltingPoint: 650,

    boilingPoint: 1090,

    electronegativity: 1.31,

    electronConfiguration: "[Ne] 3s\u00B2",

    oxidationStates: "+2",

    chemicalProperties: "镁在空气中燃烧发出耀眼白光，生成 MgO（白色）和少量 Mg₃N₂。镁能在 CO₂ 中燃烧（2Mg + CO₂ → 2MgO + C），因此镁着火不能用 CO₂ 灭火器。镁与热水缓慢反应，与酸剧烈反应。",

    history: "1808 年戴维通过电解氧化镁首次制备出镁。名称来自希腊地名马格尼西亚（Magnesia）。",

    applications: "镁合金（汽车、航空、3C 产品轻量化）、照明弹和烟花（燃烧发出强光）、铝热反应引燃剂（镁条）、叶绿素的核心元素。",

    funFact: "镁是叶绿素分子的核心原子——每个叶绿素分子中心都有一个镁离子，使植物呈现绿色。没有镁，地球上就不会有绿色植物。",

    educationalLinks: [

      "[初中] 镁在空气中燃烧",

      "[高中必修] 镁的化学性质、铝热反应中用镁条引燃",

    ],

  },

  {

    atomicNumber: 13,

    symbol: "Al",

    nameZh: "铝",

    nameEn: "Aluminium",

    atomicMass: "26.98",

    category: "post-transition-metal",

    period: 3,

    group: 13,

    groupLabel: "IIIA",

    stateAtRoomTemp: "银白色轻金属",

    density: "2.70 g/cm\u00B3",

    meltingPoint: 660.32,

    boilingPoint: 2519,

    electronegativity: 1.61,

    electronConfiguration: "[Ne] 3s\u00B2 3p\u00B9",

    oxidationStates: "+3",

    chemicalProperties: "铝是两性金属——既能与酸反应（Al + 3HCl → AlCl₃ + 3/2 H₂↑），又能与强碱反应（2Al + 2NaOH + 6H₂O → 2Na[Al(OH)₄] + 3H₂↑）。Al₂O₃ 和 Al(OH)₃ 都是两性化合物。铝在空气中表面形成致密氧化膜（Al₂O₃），阻止进一步氧化。铝热反应（Al + Fe₂O₃ → Al₂O₃ + Fe）可产生极高温度。",

    history: "1825 年丹麦物理学家奥斯特首次制备出铝。19 世纪铝曾比黄金还贵——拿破仑三世宴客时用铝制餐具招待贵宾，其他人只能用金银餐具。",

    applications: "铝合金（建筑、交通、航空）、包装（铝箔、易拉罐）、电线电缆（导电性好且轻）、铝热焊接（铁轨焊接）。",

    funFact: "铝是地壳中含量最高的金属元素（约 8%），但由于化学活性强，直到 19 世纪中期才被大量提取。华盛顿纪念碑的塔顶帽就是铝制的——在 1884 年铝还是贵重金属。",

    educationalLinks: [

      "[高中必修] 铝的两性（重要考点）、Al(OH)₃ 两性、铝热反应、工业炼铝（电解 Al₂O₃）",

    ],

  },

  {

    atomicNumber: 14,

    symbol: "Si",

    nameZh: "硅",

    nameEn: "Silicon",

    atomicMass: "28.09",

    category: "metalloid",

    period: 3,

    group: 14,

    groupLabel: "IVA",

    stateAtRoomTemp: "灰黑色有金属光泽的固体",

    density: "2.33 g/cm\u00B3",

    meltingPoint: 1414,

    boilingPoint: 3265,

    electronegativity: null,

    electronConfiguration: "[Ne] 3s\u00B2 3p\u00B2",

    oxidationStates: "+4, -4",

    chemicalProperties: "硅是半导体的基础材料。SiO₂ 是原子晶体，硬度大、熔点高。硅不溶于普通酸，但可溶于 HF：SiO₂ + 4HF → SiF₄ + 2H₂O。硅酸（H₂SiO₃）是弱酸。Na₂SiO₃ 水溶液俗称水玻璃。",

    history: "1824 年瑞典化学家贝采利乌斯首次制备出单质硅。名称来自拉丁语 silex（燧石）。",

    applications: "半导体芯片（集成电路）、太阳能电池（多晶硅/单晶硅）、光导纤维（SiO₂）、有机硅材料、玻璃和陶瓷。",

    funFact: "硅谷（Silicon Valley）就是因为硅的半导体产业而得名。硅是地壳中含量第二高的元素（仅次于氧），但自然界中不以单质存在。",

    educationalLinks: [

      "[高中必修] 硅及其化合物（SiO₂、Na₂SiO₃）、硅酸、碳与硅的对比",

      "[高中选修] 半导体材料",

    ],

  },

  {

    atomicNumber: 15,

    symbol: "P",

    nameZh: "磷",

    nameEn: "Phosphorus",

    atomicMass: "30.97",

    category: "nonmetal",

    period: 3,

    group: 15,

    groupLabel: "VA",

    stateAtRoomTemp: "蜡状固体（白磷）/ 暗红色粉末（红磷）",

    density: "1.82 g/cm\u00B3（白磷）",

    meltingPoint: 44.15,

    boilingPoint: 280.5,

    electronegativity: 2.19,

    electronConfiguration: "[Ne] 3s\u00B2 3p\u00B3",

    oxidationStates: "-3, +3, +5",

    chemicalProperties: "磷有白磷和红磷两种同素异形体。白磷（P₄）化学性质极活泼，在空气中自燃（着火点约 40°C），有剧毒。红磷较稳定，着火点约 240°C。磷在充足氧气中燃烧生成 P₂O₅（白烟）。",

    history: "1669 年德国炼金术士布兰德从大量人尿中蒸馏提取出白磷——他看到在黑暗中发光的物质，命名为 Phosphorus（希腊语带来光的）。",

    applications: "磷肥（过磷酸钙、磷酸二氢钾）、火柴（红磷）、磷酸（H₃PO₄, 食品酸味剂）、有机磷农药、DNA 和 ATP 的组成元素。",

    funFact: "白磷在空气中会发出幽幽绿光——古代墓地上传说的鬼火（磷火），实际上就是骨骼分解释放的磷化氢自燃产生的。",

    educationalLinks: [

      "[初中] 红磷燃烧测定空气中 O₂ 含量（经典实验）",

      "[高中必修] 同素异形体",

    ],

    allotropeNote: "熔点（44.1 °C）、沸点（280.5 °C）及密度（1.82 g/cm³）均以白磷为参考。红磷无固定熔点，约 590 °C 加压升华，密度 2.16 g/cm³，毒性远低于白磷。",

  },

  {

    atomicNumber: 16,

    symbol: "S",

    nameZh: "硫",

    nameEn: "Sulfur",

    atomicMass: "32.07",

    category: "nonmetal",

    period: 3,

    group: 16,

    groupLabel: "VIA",

    stateAtRoomTemp: "黄色固体",

    density: "2.07 g/cm\u00B3",

    meltingPoint: 115.21,

    boilingPoint: 444.60,

    electronegativity: 2.58,

    electronConfiguration: "[Ne] 3s\u00B2 3p\u2074",

    oxidationStates: "-2, +4, +6",

    chemicalProperties: "硫在空气中燃烧发出淡蓝色火焰，生成 SO₂（有刺激性气味的气体）。在纯氧中燃烧火焰为蓝紫色。H₂SO₄ 是最重要的工业酸，浓硫酸有脱水性、吸水性和强氧化性。SO₂ 是酸雨的重要来源之一。",

    history: "硫自古已知，古代称为硫磺。古罗马人用硫磺熏蒸消毒。拉瓦锡于 1777 年确认硫是一种元素。",

    applications: "硫酸工业（接触法）、橡胶硫化、火药（黑火药成分之一）、杀虫剂、药品。",

    funFact: "木星的卫星伊奥（Io）是太阳系中火山活动最活跃的天体，其表面的黄色就来自大量的硫和硫化物。",

    educationalLinks: [

      "[初中] 硫的燃烧",

      "[高中必修] 硫及其化合物（SO₂、H₂SO₄）、酸雨问题",

    ],

    allotropeNote: "物理数据以斜方硫（α-硫，常温最稳定形态）为参考。单斜硫（β-硫）在 95.6 °C 以上稳定，熔点 119 °C，两者可相互转化。",

  },

  {

    atomicNumber: 17,

    symbol: "Cl",

    nameZh: "氯",

    nameEn: "Chlorine",

    atomicMass: "35.45",

    category: "halogen",

    period: 3,

    group: 17,

    groupLabel: "VIIA",

    stateAtRoomTemp: "黄绿色气体",

    density: "3.214 g/L",

    meltingPoint: -101.5,

    boilingPoint: -34.04,

    electronegativity: 3.16,

    electronConfiguration: "[Ne] 3s\u00B2 3p\u2075",

    oxidationStates: "-1, +1, +3, +5, +7",

    chemicalProperties: "氯气是强氧化剂。与金属反应：2Na + Cl₂ → 2NaCl，2Fe + 3Cl₂ → 2FeCl₃（注意生成 FeCl₃ 而非 FeCl₂）。氯气溶于水（氯水）：Cl₂ + H₂O ⇌ HCl + HClO。HClO 有漂白性和杀菌性。",

    history: "1774 年瑞典化学家舍勒用盐酸与二氧化锰反应制备出氯气。1810 年戴维确认其为元素，命名 Chlorine（希腊语黄绿色）。",

    applications: "自来水消毒（Cl₂ 或 ClO₂）、漂白剂（NaClO）、PVC 塑料原料、盐酸、有机氯化物。",

    funFact: "第一次世界大战中氯气被首次作为化学武器使用（1915 年伊普尔战役），这促使了防毒面具的发明和化学武器公约的制定。",

    educationalLinks: [

      "[高中必修] 氯气的性质（核心考点）、卤素性质递变、氯水成分和性质、氯碱工业",

    ],

  },

  {

    atomicNumber: 18,

    symbol: "Ar",

    nameZh: "氩",

    nameEn: "Argon",

    atomicMass: "39.95",

    category: "noble-gas",

    period: 3,

    group: 18,

    groupLabel: "0族",

    stateAtRoomTemp: "无色无味气体",

    density: "1.784 g/L",

    meltingPoint: -189.34,

    boilingPoint: -185.85,

    electronegativity: null,

    electronConfiguration: "[Ne] 3s\u00B2 3p\u2076",

    oxidationStates: "0",

    chemicalProperties: "氩气化学性质极其稳定，不与任何物质反应。",

    history: "1894 年英国物理学家瑞利和化学家拉姆齐发现空气中氮气密度与纯氮不同，从中分离出氩气。命名 Argon 来自希腊语 argon（懒惰的），因其不与任何物质反应。",

    applications: "焊接保护气（氩弧焊）、白炽灯和荧光灯充填气、半导体制造惰性气氛、氩气刀（外科手术）。",

    funFact: "氩是大气中含量最多的稀有气体（约 0.93%），大气中的氩主要来自地壳中 K-40 的放射性衰变。",

    educationalLinks: [

      "[初中] 稀有气体",

      "[高中必修] 原子结构稳定性、保护气的应用",

    ],

  },

  // ---- 第四周期 ----

  {

    atomicNumber: 19,

    symbol: "K",

    nameZh: "钾",

    nameEn: "Potassium",

    atomicMass: "39.10",

    category: "alkali-metal",

    period: 4,

    group: 1,

    groupLabel: "IA",

    stateAtRoomTemp: "银白色软金属",

    density: "0.862 g/cm³",

    meltingPoint: 63.38,

    boilingPoint: 759,

    electronegativity: 0.82,

    electronConfiguration: "[Ar] 4s¹",

    oxidationStates: "+1",

    chemicalProperties: "钾比钠更活泼。与水反应极为剧烈，常常引起燃烧甚至爆炸。钾的焰色反应为紫色（需透过蓝色钴玻璃观察，排除钠黄光干扰）。",

    history: "1807 年戴维电解熔融 KOH 首次制备出钾。",

    applications: "钾肥（KCl、K₂SO₄）、KOH（强碱）、KMnO₄（高锰酸钾）、火柴原料。",

    funFact: "钾是人体必需的宏量元素，香蕉富含钾。钾离子在神经信号传导中起关键作用——Na⁺/K⁺ 泵是细胞膜上最重要的离子通道之一。",

    educationalLinks: [

      "[高中必修] 碱金属性质递变（Na→K 活泼性增强）、焰色反应（紫色，钴玻璃）",

    ],

  },

  {

    atomicNumber: 20,

    symbol: "Ca",

    nameZh: "钙",

    nameEn: "Calcium",

    atomicMass: "40.08",

    category: "alkaline-earth-metal",

    period: 4,

    group: 2,

    groupLabel: "IIA",

    stateAtRoomTemp: "银白色金属",

    density: "1.55 g/cm³",

    meltingPoint: 842,

    boilingPoint: 1484,

    electronegativity: 1.00,

    electronConfiguration: "[Ar] 4s²",

    oxidationStates: "+2",

    chemicalProperties: "钙与水反应生成 Ca(OH)₂（氢氧化钙，俗称熟石灰/消石灰）和 H₂。CaCO₃（石灰石/大理石）是重要的建筑和化工原料。CaO（生石灰）与水反应放出大量热。Ca(OH)₂ 是常用碱，其水溶液称为澄清石灰水，通入 CO₂ 变浑浊（生成 CaCO₃↓）。",

    history: "1808 年戴维通过电解混合物分离出钙。名称来自拉丁语 calx（石灰）。",

    applications: "石灰（建筑材料）、水泥原料、钙片（补钙）、CaCl₂（除湿剂、融雪剂）、漂白粉 Ca(ClO)₂·CaCl₂。",

    funFact: "人体中约 1-2% 的体重是钙，99% 的钙存在于骨骼和牙齿中。珊瑚礁、贝壳、蛋壳的主要成分都是 CaCO₃。",

    educationalLinks: [

      "[初中] CaO 与水反应、CaCO₃ 与酸反应、石灰水与 CO₂",

      "[高中必修] 漂白粉",

    ],

  },

  {

    atomicNumber: 21,

    symbol: "Sc",

    nameZh: "钪",

    nameEn: "Scandium",

    atomicMass: "44.96",

    category: "transition-metal",

    period: 4,

    group: 3,

    groupLabel: "IIIB",

    stateAtRoomTemp: "银白色金属",

    density: "2.99 g/cm³",

    meltingPoint: 1541,

    boilingPoint: 2836,

    electronegativity: 1.36,

    electronConfiguration: "[Ar] 3d¹ 4s²",

    oxidationStates: "+3",

    chemicalProperties: "钪是第一个过渡金属元素，化学性质活泼，主要以 +3 价存在。钪铝合金密度小、强度高，用于航天结构材料。",

    history: "1879 年瑞典化学家尼尔森发现，命名来自斯堪的纳维亚（Scandinavia）。",

    applications: "钪铝合金（航天、自行车车架、棒球棒）、钪碘灯（高效照明）。",

    funFact: "钪是门捷列夫周期表中预测的\"类硼\"元素之一，其发现完美验证了元素周期律。",

    educationalLinks: [

      "[高中选修] 过渡金属的 d 电子填充开始、第一过渡系",

    ],

  },

  {

    atomicNumber: 22,

    symbol: "Ti",

    nameZh: "钛",

    nameEn: "Titanium",

    atomicMass: "47.87",

    category: "transition-metal",

    period: 4,

    group: 4,

    groupLabel: "IVB",

    stateAtRoomTemp: "银白色金属",

    density: "4.51 g/cm³",

    meltingPoint: 1668,

    boilingPoint: 3287,

    electronegativity: 1.54,

    electronConfiguration: "[Ar] 3d² 4s²",

    oxidationStates: "+2, +3, +4",

    chemicalProperties: "钛被称为\"太空金属\"，密度低、强度高、耐腐蚀性极好。TiO₂（钛白粉）是最重要的白色颜料，也是光催化剂。钛在常温下表面形成致密氧化膜，具有优异的耐腐蚀性。",

    history: "1791 年英国牧师格雷戈尔发现，1795 年克拉普罗特命名为 Titanium（希腊神话中的泰坦巨人）。",

    applications: "航空航天合金、医疗植入物（人工关节、牙齿植入）、TiO₂ 白色颜料、光催化剂（污水处理）。",

    funFact: "钛对人体无毒且不会被排斥，因此是最好的人工骨骼材料——你的膝盖或髋关节置换很可能就是钛合金的。",

    educationalLinks: [

      "[高中选修] 过渡金属多价态、TiO₂ 金红石结构",

    ],

  },

  {

    atomicNumber: 23,

    symbol: "V",

    nameZh: "钒",

    nameEn: "Vanadium",

    atomicMass: "50.94",

    category: "transition-metal",

    period: 4,

    group: 5,

    groupLabel: "VB",

    stateAtRoomTemp: "银灰色金属",

    density: "6.11 g/cm³",

    meltingPoint: 1910,

    boilingPoint: 3407,

    electronegativity: 1.63,

    electronConfiguration: "[Ar] 3d³ 4s²",

    oxidationStates: "+2, +3, +4, +5",

    chemicalProperties: "钒的化合物因不同价态呈现不同颜色：V²⁺紫色、V³⁺绿色、VO²⁺蓝色、VO₃⁻黄色。V₂O₅ 是接触法制硫酸的催化剂。",

    history: "1801 年墨西哥矿物学家德尔里奥发现，1831 年瑞典化学家塞夫斯特伦重新发现并以北欧女神 Vanadis（弗蕾亚）命名。",

    applications: "钒钢（弹簧钢、工具钢）、V₂O₅ 催化剂（工业制硫酸）、钒液流电池（储能）。",

    funFact: "钒的多种颜色化合物使其在古代染料和玻璃着色中就有应用，但直到 19 世纪才被识别为独立元素。",

    educationalLinks: [

      "[高中必修] V₂O₅ 作为催化剂在工业制硫酸中的应用",

    ],

  },

  {

    atomicNumber: 24,

    symbol: "Cr",

    nameZh: "铬",

    nameEn: "Chromium",

    atomicMass: "52.00",

    category: "transition-metal",

    period: 4,

    group: 6,

    groupLabel: "VIB",

    stateAtRoomTemp: "银白色有金属光泽的硬质金属",

    density: "7.15 g/cm³",

    meltingPoint: 1907,

    boilingPoint: 2671,

    electronegativity: 1.66,

    electronConfiguration: "[Ar] 3d⁵ 4s¹",

    oxidationStates: "+2, +3, +6",

    chemicalProperties: "铬以多彩的化合物著称：Cr₂O₃ 绿色、K₂Cr₂O₇ 橙红色、CrO₄²⁻ 黄色。铬的电子构型为 [Ar] 3d⁵ 4s¹（而非预期的 3d⁴ 4s²），体现了半满稳定性。不锈钢中的铬含量（≥10.5%）赋予其耐腐蚀性。",

    history: "1797 年法国化学家沃克兰从红铅矿（PbCrO₄）中发现，命名 Chromium 来自希腊语 chroma（颜色）。",

    applications: "不锈钢添加剂、镀铬（防腐装饰）、K₂Cr₂O₇ 氧化剂、铬鞣革（皮革加工）。",

    funFact: "红宝石的红色来自 Cr³⁺ 取代 Al₂O₃ 中的 Al³⁺，祖母绿的绿色通常也来自 Cr³⁺——同一种离子在不同晶体环境中产生完全不同的颜色！不过部分祖母绿（如哥伦比亚某些产地）的致色离子是 V³⁺ 而非 Cr³⁺，称为「钒祖母绿」。",

    educationalLinks: [

      "[高中选修] 3d⁵ 4s¹ 半满稳定构型、K₂Cr₂O₇ 氧化还原滴定",

    ],

  },

  {

    atomicNumber: 25,

    symbol: "Mn",

    nameZh: "锰",

    nameEn: "Manganese",

    atomicMass: "54.94",

    category: "transition-metal",

    period: 4,

    group: 7,

    groupLabel: "VIIB",

    stateAtRoomTemp: "银灰色金属",

    density: "7.44 g/cm³",

    meltingPoint: 1246,

    boilingPoint: 2061,

    electronegativity: 1.55,

    electronConfiguration: "[Ar] 3d⁵ 4s²",

    oxidationStates: "+2, +4, +7",

    chemicalProperties: "锰最著名的化合物是 KMnO₄（高锰酸钾），是强氧化剂，紫色溶液。MnO₂ 是 H₂O₂ 分解和 KClO₃ 分解的催化剂，也是干电池的正极材料。锰钢（高锰钢）用于铁路道岔和挖掘机铲齿。",

    history: "1774 年瑞典化学家甘恩首次分离出锰，名称来自古希腊地名 Magnesia。",

    applications: "高锰钢（耐磨）、MnO₂（干电池正极）、KMnO₄（消毒氧化剂）、钢铁添加剂。",

    funFact: "海底锰结核是巨大的矿产资源，富含锰、镍、铜、钴，全球储量估计数千亿吨，目前深海采矿技术正在开发中。",

    educationalLinks: [

      "[初中] MnO₂ 催化 H₂O₂ 分解（经典实验）",

      "[高中必修] KMnO₄ 的氧化性、MnO₂ 与浓盐酸反应制 Cl₂",

    ],

  },

  {

    atomicNumber: 26,

    symbol: "Fe",

    nameZh: "铁",

    nameEn: "Iron",

    atomicMass: "55.85",

    category: "transition-metal",

    period: 4,

    group: 8,

    groupLabel: "VIII",

    stateAtRoomTemp: "银白色金属",

    density: "7.874 g/cm³",

    meltingPoint: 1538,

    boilingPoint: 2861,

    electronegativity: 1.83,

    electronConfiguration: "[Ar] 3d⁶ 4s²",

    oxidationStates: "+2, +3",

    chemicalProperties: "铁与盐酸/稀硫酸反应生成 Fe²⁺（亚铁离子，浅绿色）。铁在氯气中燃烧生成 FeCl₃（不是 FeCl₂！）。Fe³⁺（棕黄色）与 KSCN 生成血红色络合物（检验 Fe³⁺ 的方法）。Fe³⁺ 可被 Fe 还原为 Fe²⁺：Fe + 2Fe³⁺ → 3Fe²⁺。铁在纯氧中燃烧生成 Fe₃O₄。",

    history: "铁的使用可追溯到公元前 3000 年（陨铁），大约公元前 1200 年人类进入铁器时代，掌握了从铁矿石冶炼铁的技术。",

    applications: "钢铁工业（人类使用量最大的金属）、催化剂（合成氨铁系催化剂）、磁铁（Fe₃O₄）、血红蛋白核心元素。",

    funFact: "人体中含约 4 克铁，大部分存在于血红蛋白中——正是铁离子与氧的结合使血液呈红色。地球核心也主要由铁和镍组成。",

    educationalLinks: [

      "[初中] 铁的冶炼、铁生锈",

      "[高中必修] Fe²⁺/Fe³⁺ 转化（核心考点）、铁与酸和盐的反应、铁的氧化物",

    ],

  },

  {

    atomicNumber: 27,

    symbol: "Co",

    nameZh: "钴",

    nameEn: "Cobalt",

    atomicMass: "58.93",

    category: "transition-metal",

    period: 4,

    group: 9,

    groupLabel: "VIII",

    stateAtRoomTemp: "银白色金属（略带粉色光泽）",

    density: "8.90 g/cm³",

    meltingPoint: 1495,

    boilingPoint: 2927,

    electronegativity: 1.88,

    electronConfiguration: "[Ar] 3d⁷ 4s²",

    oxidationStates: "+2, +3",

    chemicalProperties: "钴蓝（CoAl₂O₄）是著名的蓝色颜料。⁶⁰Co 是重要的放射性同位素，用于食品辐照灭菌和癌症放疗（γ射线）。钴是维生素 B₁₂ 的核心元素。钴酸锂（LiCoO₂）是锂电池正极材料。",

    history: "1735 年瑞典化学家布兰特首次分离出钴，名称来自德语 Kobold（地下妖精），因钴矿石曾让矿工以为是铜矿而受害。",

    applications: "钴蓝颜料、LiCoO₂（锂电池正极）、钴基高温合金（航空发动机）、⁶⁰Co 放疗。",

    funFact: "维生素 B₁₂（钴胺素）是唯一含金属元素的维生素，其中钴离子是关键活性中心。严格素食者可能缺乏 B₁₂，因为 B₁₂ 主要来自动物食品。",

    educationalLinks: [

      "[高中选修] 放射性同位素应用、锂离子电池正极材料",

    ],

  },

  {

    atomicNumber: 28,

    symbol: "Ni",

    nameZh: "镍",

    nameEn: "Nickel",

    atomicMass: "58.69",

    category: "transition-metal",

    period: 4,

    group: 10,

    groupLabel: "VIII",

    stateAtRoomTemp: "银白色金属",

    density: "8.91 g/cm³",

    meltingPoint: 1455,

    boilingPoint: 2913,

    electronegativity: 1.91,

    electronConfiguration: "[Ar] 3d⁸ 4s²",

    oxidationStates: "+2",

    chemicalProperties: "镍是重要的催化剂——加氢反应中广泛使用 Ni 作催化剂（如油脂硬化、烯烃加氢）。镍铬合金用于电热丝。不锈钢中含约 8% 的镍以提高韧性和耐腐蚀性。镍氢电池和早期镍镉电池是重要的二次电池。",

    history: "1751 年瑞典矿物学家克隆斯泰特首次分离，名称来自德语 Nickel（淘气鬼），因矿工误以为含铜。",

    applications: "不锈钢添加剂、Ni 催化剂（加氢反应）、镍氢电池、镀镍（防腐）、镍铬电热丝。",

    funFact: "美国 5 分硬币（nickel）只含 25% 的镍，其余是铜——但硬币名字直接来自镍元素，因为早期 5 分硬币含镍较多。",

    educationalLinks: [

      "[高中选修] Ni 催化加氢反应（有机化学实验中的常用催化剂）",

    ],

  },

  {

    atomicNumber: 29,

    symbol: "Cu",

    nameZh: "铜",

    nameEn: "Copper",

    atomicMass: "63.55",

    category: "transition-metal",

    period: 4,

    group: 11,

    groupLabel: "IB",

    stateAtRoomTemp: "紫红色金属",

    density: "8.96 g/cm³",

    meltingPoint: 1084.62,

    boilingPoint: 2562,

    electronegativity: 1.90,

    electronConfiguration: "[Ar] 3d¹⁰ 4s¹",

    oxidationStates: "+1, +2",

    chemicalProperties: "铜在金属活动性顺序中排在氢后面，不与稀酸反应。但能与浓硫酸（加热）和稀/浓硝酸反应。Cu²⁺ 溶液呈蓝色。CuSO₄ 无水为白色（可用于检验水的存在），含结晶水为蓝色（CuSO₄·5H₂O 胆矾/蓝矾）。Cu(OH)₂ 蓝色沉淀可用于检验醛基。",

    history: "铜是人类最早使用的金属之一（约公元前 8000 年），铜器时代先于铁器时代。名称 Copper 来自拉丁语 Cyprium（塞浦路斯岛盛产铜）。",

    applications: "电线电缆（导电性仅次于银）、铜管（水暖管道）、铜合金（黄铜、青铜）、电路板、硬币。",

    funFact: "自由女神像外壳是铜制的，原本是闪亮的铜色。经过约 20 年的氧化，表面生成了铜绿 Cu₂(OH)₂CO₃（碱式碳酸铜），变成了今天标志性的绿色。",

    educationalLinks: [

      "[初中] 铜与硫酸铜溶液、铁置换铜实验",

      "[高中必修] Cu 与浓硫酸/硝酸反应、CuSO₄·5H₂O 结晶水实验、Cu 电解精炼",

    ],

  },

  {

    atomicNumber: 30,

    symbol: "Zn",

    nameZh: "锌",

    nameEn: "Zinc",

    atomicMass: "65.38",

    category: "transition-metal",

    period: 4,

    group: 12,

    groupLabel: "IIB",

    stateAtRoomTemp: "蓝白色金属",

    density: "7.13 g/cm³",

    meltingPoint: 419.53,

    boilingPoint: 907,

    electronegativity: 1.65,

    electronConfiguration: "[Ar] 3d¹⁰ 4s²",

    oxidationStates: "+2",

    chemicalProperties: "锌是活泼金属，能与稀酸反应产生 H₂（实验室制氢气的经典方法）。锌是重要的还原剂，位于活动性顺序 Fe 之前。锌在潮湿空气中表面生成碱式碳酸锌保护层。锌是原电池中常用的负极材料。",

    history: "锌的使用可追溯到古罗马时期（黄铜合金），但直到 1746 年德国化学家马格拉夫才首次从矿石中分离出纯锌。",

    applications: "镀锌钢（防锈）、干电池负极、黄铜（Cu-Zn 合金）、锌合金压铸件、ZnO（防晒霜、橡胶添加剂）。",

    funFact: "人体每天需要约 10-15 毫克锌。缺锌会导致味觉丧失、免疫力下降和伤口愈合缓慢——含锌的牡蛎和牛肉是补锌佳品。",

    educationalLinks: [

      "[初中] Zn + HCl 制氢气（核心实验）",

      "[高中必修] Zn-Cu 原电池、金属活动性",

    ],

  },

  {

    atomicNumber: 31,

    symbol: "Ga",

    nameZh: "镓",

    nameEn: "Gallium",

    atomicMass: "69.72",

    category: "post-transition-metal",

    period: 4,

    group: 13,

    groupLabel: "IIIA",

    stateAtRoomTemp: "银白色软金属",

    density: "5.91 g/cm³",

    meltingPoint: 29.76,

    boilingPoint: 2229,

    electronegativity: 1.81,

    electronConfiguration: "[Ar] 3d¹⁰ 4s² 4p¹",

    oxidationStates: "+3",

    chemicalProperties: "镓的熔点仅 29.76°C，放在手心就会融化。GaAs（砷化镓）是重要的半导体材料，用于 LED、太阳能电池和微波器件。GaN（氮化镓）用于蓝色 LED 和高频电子器件。",

    history: "1875 年法国化学家布瓦博德朗发现，命名来自法国的拉丁语名 Gallia。这正是门捷列夫预言的\"类铝\"元素，发现时完美验证了周期律的预测。",

    applications: "GaAs、GaN 半导体（LED、太阳能电池）、高频通信器件、镓铟锡合金（液态金属）。",

    funFact: "镓是少数几种可以在手掌温度下融化的金属——用镓制作的\"会在手中融化的金属勺子\"是经典的化学趣味实验。",

    educationalLinks: [

      "[高中必修] 门捷列夫对周期律的预测（\"类铝\"即镓）",

    ],

  },

  {

    atomicNumber: 32,

    symbol: "Ge",

    nameZh: "锗",

    nameEn: "Germanium",

    atomicMass: "72.63",

    category: "metalloid",

    period: 4,

    group: 14,

    groupLabel: "IVA",

    stateAtRoomTemp: "灰白色脆性固体（有金属光泽）",

    density: "5.323 g/cm³",

    meltingPoint: 938.25,

    boilingPoint: 2833,

    electronegativity: 2.01,

    electronConfiguration: "[Ar] 3d¹⁰ 4s² 4p²",

    oxidationStates: "+2, +4",

    chemicalProperties: "锗是重要的半导体材料，世界上第一个晶体管就是用锗制成的（1947 年）。锗对红外线透明，用于红外光学器件。锗的化学性质与硅相似，能形成 GeO₂、GeH₄ 等化合物。",

    history: "1886 年德国化学家温克勒发现，命名来自德国的拉丁语 Germania。这正是门捷列夫预言的\"类硅\"元素。",

    applications: "红外光学（夜视仪镜头）、光纤（GeO₂ 掺杂）、早期晶体管（现已被硅取代）。",

    funFact: "门捷列夫在 1871 年预测了\"类硅\"的性质（原子量约 72、密度约 5.5），与 1886 年发现的锗（原子量 72.6、密度 5.35）惊人吻合，这一预测被誉为元素周期律的最有力证据之一。",

    educationalLinks: [

      "[高中必修] 门捷列夫对\"类硅\"（锗）的预测、半导体材料",

    ],

  },

  {

    atomicNumber: 33,

    symbol: "As",

    nameZh: "砷",

    nameEn: "Arsenic",

    atomicMass: "74.92",

    category: "metalloid",

    period: 4,

    group: 15,

    groupLabel: "VA",

    stateAtRoomTemp: "灰色脆性固体（灰砷）",

    density: "5.727 g/cm³",

    meltingPoint: 817,

    boilingPoint: 614,

    electronegativity: 2.18,

    electronConfiguration: "[Ar] 3d¹⁰ 4s² 4p³",

    oxidationStates: "-3, +3, +5",

    chemicalProperties: "砷的化合物 As₂O₃ 俗称\"砒霜\"，是著名的毒药（LD₅₀ 约 14 mg/kg）。砷化镓（GaAs）是重要的半导体。砷化氢（AsH₃）剧毒。砷以 -3、+3、+5 价存在，化学性质与磷相似。",

    history: "砷化合物古代已知，1250 年左右阿尔伯特大帝首次制得砷单质。名称来自希腊语 arsenikon（黄色颜料）。",

    applications: "GaAs 半导体、木材防腐剂（现已限用）、砷化镓太阳能电池。",

    funFact: "中国古代验毒用的\"银针试毒\"实际上不能检测大部分毒药——银针变黑只能说明食物中含有硫化物，与砒霜无关（除非砒霜中混有硫化物杂质）。",

    educationalLinks: [

      "[拓展] 半导体材料 GaAs",

    ],

  },

  {

    atomicNumber: 34,

    symbol: "Se",

    nameZh: "硒",

    nameEn: "Selenium",

    atomicMass: "78.97",

    category: "nonmetal",

    period: 4,

    group: 16,

    groupLabel: "VIA",

    stateAtRoomTemp: "灰色固体（灰硒）/ 红色固体（红硒）",

    density: "4.81 g/cm³",

    meltingPoint: 220.8,

    boilingPoint: 685,

    electronegativity: 2.55,

    electronConfiguration: "[Ar] 3d¹⁰ 4s² 4p⁴",

    oxidationStates: "-2, +4, +6",

    chemicalProperties: "硒是人体必需的微量元素，缺硒会导致克山病。硒的导电性随光照强度变化（光电导性），用于光电池和复印机的感光鼓。硒与硫化学性质相似，是硫的同族元素（VIA 族）。",

    history: "1817 年瑞典化学家贝采利乌斯发现，命名来自希腊语 selene（月亮），因其化学性质与碲（Tellurium，来自地球）相似。",

    applications: "光电池和感光鼓（复印机）、玻璃脱色剂、补硒保健品。",

    funFact: "中国黑龙江克山县因土壤严重缺硒导致当地居民心肌病（克山病）高发，后来通过食盐加硒的措施基本消除了这一地方病。",

    educationalLinks: [

      "[高中选修] 同族元素性质递变",

    ],

    allotropeNote: "物理数据（密度 4.81 g/cm³、熔点 221 °C）以灰硒（六方晶系，最稳定形态）为参考。红硒为非晶态，密度较低，光照或加热后转变为灰硒。",

  },

  {

    atomicNumber: 35,

    symbol: "Br",

    nameZh: "溴",

    nameEn: "Bromine",

    atomicMass: "79.90",

    category: "halogen",

    period: 4,

    group: 17,

    groupLabel: "VIIA",

    stateAtRoomTemp: "深红棕色液体",

    density: "3.12 g/cm³",

    meltingPoint: -7.2,

    boilingPoint: 58.8,

    electronegativity: 2.96,

    electronConfiguration: "[Ar] 3d¹⁰ 4s² 4p⁵",

    oxidationStates: "-1, +1, +5",

    chemicalProperties: "溴是常温下唯一的液态非金属单质，深红棕色，有刺激性气味，蒸气有毒。溴水是橙黄色溶液。溴能使不饱和烃（含 C=C）褪色（加成反应），这是检验不饱和烃的经典方法。溴与碘化钾反应：Br₂ + 2KI → 2KBr + I₂（氧化性 Cl₂ > Br₂ > I₂）。",

    history: "1826 年法国化学家巴拉尔和德国学生勒维希几乎同时独立发现溴。名称来自希腊语 bromos（恶臭）。",

    applications: "有机溴化物（阻燃剂、农药）、溴化银（AgBr，摄影胶片）、溴水检验不饱和烃、海水提溴。",

    funFact: "溴的名称来自希腊语 bromos（\"恶臭\"），确实名副其实——液溴气味极其刺鼻，操作时必须在通风橱中进行。",

    educationalLinks: [

      "[高中必修] 卤素性质递变（F₂→Cl₂→Br₂→I₂）、溴水检验不饱和烃",

      "[高中选修] 卤代烃的制备",

    ],

  },

  {

    atomicNumber: 36,

    symbol: "Kr",

    nameZh: "氪",

    nameEn: "Krypton",

    atomicMass: "83.80",

    category: "noble-gas",

    period: 4,

    group: 18,

    groupLabel: "0族",

    stateAtRoomTemp: "无色无味气体",

    density: "3.749 g/L",

    meltingPoint: -157.36,

    boilingPoint: -153.22,

    electronegativity: 3.00,

    electronConfiguration: "[Ar] 3d¹⁰ 4s² 4p⁶",

    oxidationStates: "0",

    chemicalProperties: "氪气在放电管中发出白色光，用于摄影闪光灯和机场跑道灯。2000 年后发现了 KrF₂ 等少数氪化合物，打破了稀有气体完全不反应的传统观念。",

    history: "1898 年英国化学家拉姆齐和特拉弗斯从液态空气蒸馏残余中发现，命名来自希腊语 kryptos（隐藏的）。",

    applications: "摄影闪光灯、机场跑道灯、氪离子激光器、绝热双层玻璃充填气。",

    funFact: "超人的故乡叫\"氪星\"（Krypton），他的弱点\"氪石\"（Kryptonite）的名字就来源于这个元素——但真实的氪气当然没有超能力。",

    educationalLinks: [

      "[高中选修] 稀有气体化合物的发现打破了\"稀有气体完全不反应\"的传统观念",

    ],

  },

  // ---- 第五周期 ----

  {

    atomicNumber: 37,

    symbol: "Rb",

    nameZh: "铷",

    nameEn: "Rubidium",

    atomicMass: "85.47",

    category: "alkali-metal",

    period: 5,

    group: 1,

    groupLabel: "IA",

    stateAtRoomTemp: "银白色软金属",

    density: "1.532 g/cm³",

    meltingPoint: 39.31,

    boilingPoint: 688,

    electronegativity: 0.82,

    electronConfiguration: "[Kr] 5s¹",

    oxidationStates: "+1",

    chemicalProperties: "铷比钾更活泼，与水反应极为剧烈。铷的焰色反应为紫红色。铷蒸气的超精细跃迁频率用于原子钟的时间标准。",

    history: "1861 年德国化学家本生和基尔霍夫通过光谱分析发现，命名来自拉丁语 rubidus（深红色，因其光谱线）。",

    applications: "铷原子钟（GPS 卫星的时间基准）、光电池、研究用碱金属。",

    funFact: "铷是光谱分析技术发现的第一批元素之一，本生和基尔霍夫发明了分光镜后，短短几年内就发现了铷和铯两种新元素。",

    educationalLinks: [

      "[高中选修] 碱金属性质递变趋势的延伸",

    ],

  },

  {

    atomicNumber: 38,

    symbol: "Sr",

    nameZh: "锶",

    nameEn: "Strontium",

    atomicMass: "87.62",

    category: "alkaline-earth-metal",

    period: 5,

    group: 2,

    groupLabel: "IIA",

    stateAtRoomTemp: "银白色金属",

    density: "2.64 g/cm³",

    meltingPoint: 777,

    boilingPoint: 1382,

    electronegativity: 0.95,

    electronConfiguration: "[Kr] 5s²",

    oxidationStates: "+2",

    chemicalProperties: "锶的焰色反应为洋红色，用于烟花和信号弹。⁹⁰Sr 是核裂变产物之一，有放射性，会在骨骼中积累（化学性质类似钙）。锶与水反应生成 Sr(OH)₂ 和 H₂。",

    history: "1790 年发现于苏格兰矿石中，1808 年戴维首次分离，命名来自苏格兰小镇 Strontian。",

    applications: "烟花和信号弹（洋红色火焰）、阴极射线管（SrO 防 X 射线泄漏）、锶磁铁。",

    funFact: "⁹⁰Sr 是核武器试验最危险的副产品之一，因其化学性质与钙相似会积聚在骨骼中，持续辐射骨髓，造成长期放射性伤害。",

    educationalLinks: [

      "[拓展] 焰色反应、放射性同位素",

    ],

  },

  {

    atomicNumber: 39,

    symbol: "Y",

    nameZh: "钇",

    nameEn: "Yttrium",

    atomicMass: "88.91",

    category: "transition-metal",

    period: 5,

    group: 3,

    groupLabel: "IIIB",

    stateAtRoomTemp: "银白色金属",

    density: "4.472 g/cm³",

    meltingPoint: 1526,

    boilingPoint: 3336,

    electronegativity: 1.22,

    electronConfiguration: "[Kr] 4d¹ 5s²",

    oxidationStates: "+3",

    chemicalProperties: "钇主要以 +3 价存在，化学性质与镧系元素相似。YAG（钇铝石榴石）激光器是最常用的固态激光器。YBCO（YBa₂Cu₃O₇）是第一个在液氮温度以上超导的材料。",

    history: "1794 年芬兰化学家加多林从矿石中发现，1828 年被命名为 Yttrium，来自瑞典小村庄 Ytterby。",

    applications: "YAG 激光器、高温超导材料（YBCO）、钇铁石榴石（微波器件）、LED 荧光粉。",

    funFact: "Ytterby 这个瑞典小村庄是元素命名史上最丰产的地方，共有 4 种元素（钇、铒、铽、镱）以它命名——因为那里的矿石中含有大量稀土元素。",

    educationalLinks: [],

  },

  {

    atomicNumber: 40,

    symbol: "Zr",

    nameZh: "锆",

    nameEn: "Zirconium",

    atomicMass: "91.22",

    category: "transition-metal",

    period: 5,

    group: 4,

    groupLabel: "IVB",

    stateAtRoomTemp: "银白色金属",

    density: "6.506 g/cm³",

    meltingPoint: 1855,

    boilingPoint: 4409,

    electronegativity: 1.33,

    electronConfiguration: "[Kr] 4d² 5s²",

    oxidationStates: "+4",

    chemicalProperties: "锆合金在核反应堆中用作燃料棒的包壳材料（对中子几乎透明，热中子截面极小）。ZrO₂（氧化锆）是人造钻石的主要材料，也用于陶瓷刀具。锆耐腐蚀性极强。",

    history: "1789 年德国化学家克拉普罗特在锆石中发现，1824 年贝采利乌斯首次分离出金属锆，名称来自阿拉伯语 zargun（金色）。",

    applications: "核反应堆燃料棒包壳、立方氧化锆（人造钻石）、ZrO₂ 陶瓷刀具、耐火材料。",

    funFact: "立方氧化锆（CZ）是最常见的钻石替代品，折射率和色散与钻石极为接近，肉眼难以区分——大部分廉价\"钻石\"首饰实际上是氧化锆。",

    educationalLinks: [],

  },

  {

    atomicNumber: 41,

    symbol: "Nb",

    nameZh: "铌",

    nameEn: "Niobium",

    atomicMass: "92.91",

    category: "transition-metal",

    period: 5,

    group: 5,

    groupLabel: "VB",

    stateAtRoomTemp: "灰色金属",

    density: "8.57 g/cm³",

    meltingPoint: 2477,

    boilingPoint: 4744,

    electronegativity: 1.60,

    electronConfiguration: "[Kr] 4d⁴ 5s¹",

    oxidationStates: "+3, +5",

    chemicalProperties: "铌钛合金是最常用的超导材料，MRI 扫描仪的超导磁体就是铌钛合金线圈。铌加入钢中可显著提高强度和韧性。铌在高温下耐腐蚀性好。",

    history: "1801 年英国化学家哈契特发现，命名来自希腊神话中坦塔洛斯的女儿尼俄柏（Niobe），因铌与钽性质极为相似。",

    applications: "超导磁体合金（MRI）、高强度低合金钢（管道、汽车）、超导加速器。",

    funFact: "铌和钽（Tantalum）性质如此相似，以至于在 40 多年间人们以为它们是同一种元素——因此铌以坦塔洛斯之女命名，暗示两者的\"亲缘关系\"。",

    educationalLinks: [],

  },

  {

    atomicNumber: 42,

    symbol: "Mo",

    nameZh: "钼",

    nameEn: "Molybdenum",

    atomicMass: "95.96",

    category: "transition-metal",

    period: 5,

    group: 6,

    groupLabel: "VIB",

    stateAtRoomTemp: "银白色金属",

    density: "10.22 g/cm³",

    meltingPoint: 2623,

    boilingPoint: 4639,

    electronegativity: 2.16,

    electronConfiguration: "[Kr] 4d⁵ 5s¹",

    oxidationStates: "+4, +6",

    chemicalProperties: "钼是高温合金钢的重要添加元素，显著提高钢的强度和硬度。MoS₂（二硫化钼）是优良的固体润滑剂。钼是固氮酶的核心元素——豆科植物根瘤中的固氮酶含有钼铁辅基。",

    history: "1778 年瑞典化学家舍勒从钼矿中分离出 MoO₃，1781 年耶尔姆首次制备出金属钼，名称来自希腊语 molybdos（铅，因矿石外形相似）。",

    applications: "钼钢（高强度结构钢）、MoS₂ 润滑剂、催化剂（加氢脱硫）、钼丝（灯泡、电炉）。",

    funFact: "钼是植物必需的微量元素，缺钼的花椰菜叶片会变成\"鞭尾状\"——叶片卷曲成条状而无法正常展开，是典型的缺素症状。",

    educationalLinks: [],

  },

  {

    atomicNumber: 43,

    symbol: "Tc",

    nameZh: "锝",

    nameEn: "Technetium",

    atomicMass: "(98)",

    category: "transition-metal",

    period: 5,

    group: 7,

    groupLabel: "VIIB",

    stateAtRoomTemp: "银灰色金属",

    density: "11.5 g/cm³",

    meltingPoint: 2157,

    boilingPoint: 4265,

    electronegativity: 1.90,

    electronConfiguration: "[Kr] 4d⁵ 5s²",

    oxidationStates: "+4, +7",

    chemicalProperties: "锝是第一个人工合成的元素（1937 年），所有同位素均有放射性。⁹⁹ᵐTc 是医学影像中最常用的放射性示踪剂（核医学 SPECT 扫描），半衰期约 6 小时，衰变后无害。",

    history: "1937 年意大利物理学家塞格雷和帕里耶里从加速器轰击过的钼靶中发现，命名来自希腊语 technetos（人造的）。",

    applications: "⁹⁹ᵐTc 医学影像（骨扫描、心脏灌注显像）、腐蚀防护剂（密封系统中）。",

    funFact: "锝是元素周期表中原子序数最小的人工合成元素。它的存在实际上在 1925 年就被\"发现\"并命名为 masurium，但后来证明是错误的——真正的锝直到核反应出现后才被制备出来。",

    educationalLinks: [],

  },

  {

    atomicNumber: 44,

    symbol: "Ru",

    nameZh: "钌",

    nameEn: "Ruthenium",

    atomicMass: "101.07",

    category: "transition-metal",

    period: 5,

    group: 8,

    groupLabel: "VIII",

    stateAtRoomTemp: "银白色坚硬金属",

    density: "12.37 g/cm³",

    meltingPoint: 2334,

    boilingPoint: 4150,

    electronegativity: 2.20,

    electronConfiguration: "[Kr] 4d⁷ 5s¹",

    oxidationStates: "+3, +4, +8",

    chemicalProperties: "钌是铂族金属之一，耐腐蚀性极好。RuO₂ 是氯碱工业阳极涂层的重要成分。钌络合物（如 [Ru(bpy)₃]²⁺）用于染料敏化太阳能电池的光敏剂。",

    history: "1844 年俄国化学家克劳斯发现，命名来自拉丁语 Ruthenia（俄罗斯）。",

    applications: "染料敏化太阳能电池光敏剂、氯碱工业电极、钌铱合金（钢笔笔尖）、硬盘磁层。",

    funFact: "钢笔笔尖上的金色小点通常是钌铱合金制成的——这种合金极其耐磨，使笔尖能写出数百万字而不磨损。",

    educationalLinks: [],

  },

  {

    atomicNumber: 45,

    symbol: "Rh",

    nameZh: "铑",

    nameEn: "Rhodium",

    atomicMass: "102.91",

    category: "transition-metal",

    period: 5,

    group: 9,

    groupLabel: "VIII",

    stateAtRoomTemp: "银白色坚硬金属",

    density: "12.41 g/cm³",

    meltingPoint: 1964,

    boilingPoint: 3695,

    electronegativity: 2.28,

    electronConfiguration: "[Kr] 4d⁸ 5s¹",

    oxidationStates: "+3",

    chemicalProperties: "铑是最贵的铂族金属之一，三元催化剂的关键成分，用于汽车尾气处理（Pt-Pd-Rh 催化 NOₓ→N₂）。铑反射率高，用于高质量镜面镀层。",

    history: "1803 年英国化学家沃拉斯顿从铂矿中发现，命名来自希腊语 rhodon（玫瑰），因其盐溶液呈玫瑰红色。",

    applications: "三元催化剂（汽车尾气 NOₓ 净化）、高反射率镜面镀层、铑铂热电偶（高温测量）。",

    funFact: "铑是地球上最稀有的金属之一，价格通常是黄金的几倍到几十倍。一辆汽车的三元催化剂中仅含约 0.5-2 克铑，却价值不菲。",

    educationalLinks: [],

  },

  {

    atomicNumber: 46,

    symbol: "Pd",

    nameZh: "钯",

    nameEn: "Palladium",

    atomicMass: "106.42",

    category: "transition-metal",

    period: 5,

    group: 10,

    groupLabel: "VIII",

    stateAtRoomTemp: "银白色金属",

    density: "12.023 g/cm³",

    meltingPoint: 1554.9,

    boilingPoint: 2963,

    electronegativity: 2.20,

    electronConfiguration: "[Kr] 4d¹⁰",

    oxidationStates: "+2, +4",

    chemicalProperties: "钯碳（Pd/C）是有机合成中最重要的加氢催化剂之一。钯能大量吸收氢气（体积的 900 倍），可用于氢气提纯和储存。2010 年诺贝尔化学奖授予钯催化的交叉偶联反应。钯的电子构型为 [Kr] 4d¹⁰，没有 5s 电子，是特殊的全充满 d 轨道构型。",

    history: "1803 年英国化学家沃拉斯顿从铂矿中发现，命名来自小行星 Pallas（智慧女神帕拉斯）。",

    applications: "Pd/C 加氢催化剂（有机合成）、三元催化剂（汽车尾气）、氢气纯化膜、钯金珠宝（白金替代）。",

    funFact: "2010 年诺贝尔化学奖授予\"钯催化的交叉偶联反应\"（赫克、铃木、根岸），现代药物分子中约 30% 在合成过程中用到了钯催化偶联反应。",

    educationalLinks: [],

  },

  {

    atomicNumber: 47,

    symbol: "Ag",

    nameZh: "银",

    nameEn: "Silver",

    atomicMass: "107.87",

    category: "transition-metal",

    period: 5,

    group: 11,

    groupLabel: "IB",

    stateAtRoomTemp: "银白色有光泽金属",

    density: "10.49 g/cm³",

    meltingPoint: 961.78,

    boilingPoint: 2162,

    electronegativity: 1.93,

    electronConfiguration: "[Kr] 4d¹⁰ 5s¹",

    oxidationStates: "+1",

    chemicalProperties: "银是导电性和导热性最好的金属。AgNO₃ 溶液可用于检验 Cl⁻（生成白色 AgCl↓，不溶于稀 HNO₃）。AgBr 感光性是传统摄影胶片的基础（光照后 AgBr 分解为 Ag 和 Br₂）。银镜反应（醛 + 银氨溶液 → 银镜 + 羧酸铵）是检验醛基的重要方法。",

    history: "银是人类最早使用的金属之一（约公元前 3000 年）。名称来自盎格鲁撒克逊语 seolfor，元素符号 Ag 来自拉丁语 argentum。",

    applications: "电气触点和导线（最高导电性）、摄影胶片（AgBr）、银器餐具、杀菌剂（AgNO₃ 眼药水）、银基钎焊料。",

    funFact: "银的抗菌性自古已知——古代波斯王室用银器储水、饮水，甚至在伤口上敷银片。现代医学已证实 Ag⁺ 能破坏细菌细胞膜，是有效的抗菌剂。",

    educationalLinks: [

      "[高中必修] Ag⁺ 检验 Cl⁻（加 AgNO₃ 再加稀 HNO₃）、银镜反应",

    ],

  },

  {

    atomicNumber: 48,

    symbol: "Cd",

    nameZh: "镉",

    nameEn: "Cadmium",

    atomicMass: "112.41",

    category: "transition-metal",

    period: 5,

    group: 12,

    groupLabel: "IIB",

    stateAtRoomTemp: "蓝白色软金属",

    density: "8.69 g/cm³",

    meltingPoint: 321.07,

    boilingPoint: 767,

    electronegativity: 1.69,

    electronConfiguration: "[Kr] 4d¹⁰ 5s²",

    oxidationStates: "+2",

    chemicalProperties: "镉是有毒重金属，可在人体骨骼中蓄积。日本富山县\"痛痛病\"（itai-itai byo）就是镉矿排放污染稻田造成的公害事件。镍镉电池曾广泛使用但因环保问题逐步被淘汰。CdS 是黄色颜料（镉黄）。",

    history: "1817 年德国化学家施特罗迈尔从碳酸锌矿中发现，命名来自希腊语 kadmeia（氧化锌矿的古名）。",

    applications: "NiCd 充电电池（历史）、CdS/CdSe 量子点（显示屏）、镉黄颜料（艺术）、镀镉（防腐，正被限制）。",

    funFact: "痛痛病患者因骨骼软化、钙质流失，轻微碰撞就能引起骨折，患者痛苦呻吟声不断，故名\"痛痛病\"。这是 20 世纪日本\"四大公害病\"之一，推动了严格的重金属排放管制立法。",

    educationalLinks: [

      "[拓展] 重金属污染与环保",

    ],

  },

  {

    atomicNumber: 49,

    symbol: "In",

    nameZh: "铟",

    nameEn: "Indium",

    atomicMass: "114.82",

    category: "post-transition-metal",

    period: 5,

    group: 13,

    groupLabel: "IIIA",

    stateAtRoomTemp: "银白色软金属",

    density: "7.31 g/cm³",

    meltingPoint: 156.60,

    boilingPoint: 2072,

    electronegativity: 1.78,

    electronConfiguration: "[Kr] 4d¹⁰ 5s² 5p¹",

    oxidationStates: "+3",

    chemicalProperties: "铟非常软，可以用指甲划痕，弯曲时发出特殊的\"铟叫声\"（锡鸣）。铟锡氧化物（ITO）是透明导电薄膜材料，用于触摸屏和 LCD 显示器。铟的熔点较低，用于低熔点合金。",

    history: "1863 年德国化学家赖希和里希特通过光谱分析发现，命名来自其特征靛蓝色（indigo）光谱线。",

    applications: "ITO 透明导电薄膜（触摸屏、LCD）、低熔点合金（焊料）、CIGS 薄膜太阳能电池。",

    funFact: "现代智能手机的触摸屏之所以能导电感应手指，关键材料就是铟锡氧化物（ITO）——这种薄膜透明且导电。随着触摸屏的普及，铟的需求激增，已成为战略性稀缺资源。",

    educationalLinks: [],

  },

  {

    atomicNumber: 50,

    symbol: "Sn",

    nameZh: "锡",

    nameEn: "Tin",

    atomicMass: "118.71",

    category: "post-transition-metal",

    period: 5,

    group: 14,

    groupLabel: "IVA",

    stateAtRoomTemp: "银白色有光泽金属",

    density: "7.31 g/cm³",

    meltingPoint: 231.93,

    boilingPoint: 2602,

    electronegativity: 1.96,

    electronConfiguration: "[Kr] 4d¹⁰ 5s² 5p²",

    oxidationStates: "+2, +4",

    chemicalProperties: "锡有两种同素异形体：白锡（金属态，β-Sn，稳定态在 13.2°C 以上）和灰锡（粉末态，α-Sn，稳定态在 13.2°C 以下）。低温下白锡转变为灰锡并碎裂，称为\"锡疫\"。锡不与稀酸缓慢反应，与浓酸反应生成 Sn⁴⁺。",

    history: "锡是人类最早使用的金属之一（约公元前 3500 年），铜锡合金（青铜）标志着青铜时代的到来。名称来自盎格鲁撒克逊语 tin，元素符号 Sn 来自拉丁语 stannum。",

    applications: "马口铁（镀锡铁皮，食品罐头）、锡焊（电子工业，Sn-Pb 或无铅焊锡）、青铜（Sn-Cu 合金）、锡纸（历史上曾是锡，现多为铝箔）。",

    funFact: "1812 年拿破仑远征俄国失败的原因之一据传与\"锡疫\"有关——俄国极寒天气使法军制服上的锡纽扣碎裂。虽然历史学家对此有争议，但\"锡疫\"现象本身是真实存在的化学相变。",

    educationalLinks: [

      "[高中选修] 同素异形体（白锡/灰锡）",

    ],

    allotropeNote: "物理数据（密度 7.31 g/cm³、熔点 232 °C）以白锡（β-Sn，常温稳定相）为参考。低于 13.2 °C 转变为灰锡（α-Sn），密度降为 5.77 g/cm³，体积膨胀约 26%，导致金属碎裂（「锡疫」）。",

  },

  {
    atomicNumber: 51,
    symbol: "Sb",
    nameZh: "锑",
    nameEn: "Antimony",
    atomicMass: "121.76",
    category: "metalloid",
    period: 5,
    group: 15,
    groupLabel: "VA",
    stateAtRoomTemp: "银白色有光泽固体",
    density: "6.68 g/cm³",
    meltingPoint: 630.63,
    boilingPoint: 1587,
    electronegativity: 2.05,
    electronConfiguration: "[Kr] 4d¹⁰ 5s² 5p³",
    oxidationStates: "+3, +5",
    chemicalProperties: "锑质脆，有金属光泽，是典型的类金属。Sb₂O₃ 与卤素阻燃剂协效使用，是重要的阻燃助剂。锑不溶于稀盐酸，与浓 HNO₃ 反应生成 Sb₂O₅。",
    history: "古埃及人已用辉锑矿（Sb₂S₃）磨粉作眼影，元素符号 Sb 来自拉丁语 stibium。16 世纪巴西利乌斯·瓦伦蒂努斯对其有详细记载。",
    applications: "阻燃剂（Sb₂O₃ 与卤素协效）、铅蓄电池合金（提高极板硬度）、半导体材料、焊料合金。",
    funFact: "古埃及人用辉锑矿磨成的黑色粉末作眼影，现代研究发现此粉末在潮湿环境中会生成抗菌化合物，这可能是古埃及人眼部感染率较低的原因之一。",
    educationalLinks: [],
  },

  {
    atomicNumber: 52,
    symbol: "Te",
    nameZh: "碲",
    nameEn: "Tellurium",
    atomicMass: "127.60",
    category: "metalloid",
    period: 5,
    group: 16,
    groupLabel: "VIA",
    stateAtRoomTemp: "银白色固体",
    density: "6.24 g/cm³",
    meltingPoint: 449.51,
    boilingPoint: 988,
    electronegativity: 2.1,
    electronConfiguration: "[Kr] 4d¹⁰ 5s² 5p⁴",
    oxidationStates: "-2, +4, +6",
    chemicalProperties: "碲是典型的类金属，具有半导体性质，导电性随温度升高而增强。碲化镉（CdTe）是重要的薄膜太阳能电池材料。碲化铋（Bi₂Te₃）是室温附近最佳热电材料。",
    history: "1782 年穆勒·冯·赖兴施泰因在特兰西瓦尼亚矿石中发现，1798 年克拉普罗特命名，tellurium 来自拉丁语 tellus（地球）。",
    applications: "碲化镉（CdTe）薄膜太阳能电池、碲化铋热电器件（半导体制冷/温差发电）、碲化镉汞红外探测器。",
    funFact: "碲是地壳中极为稀少的稳定元素之一，丰度比铂还低。随着碲化镉薄膜太阳能电池的兴起，碲已成为战略性稀缺资源。",
    educationalLinks: [],
  },

  {
    atomicNumber: 53,
    symbol: "I",
    nameZh: "碘",
    nameEn: "Iodine",
    atomicMass: "126.90",
    category: "halogen",
    period: 5,
    group: 17,
    groupLabel: "VIIA",
    stateAtRoomTemp: "紫黑色固体（加热直接升华）",
    density: "4.93 g/cm³",
    meltingPoint: 113.7,
    boilingPoint: 184.3,
    electronegativity: 2.66,
    electronConfiguration: "[Kr] 4d¹⁰ 5s² 5p⁵",
    oxidationStates: "-1, +5, +7",
    chemicalProperties: "碘单质是紫黑色固体，加热后直接升华为紫色蒸气。碘遇淀粉变蓝是最经典的检验反应。碘在水中溶解度很低，但易溶于 KI 溶液（生成 I₃⁻）和有机溶剂（在 CCl₄ 中呈紫色）。碘的氧化性在卤素中最弱。",
    history: "1811 年法国化学家库尔图瓦从海藻灰中发现，命名来自希腊语 iodes（紫色）。碘是人体必需微量元素，用于合成甲状腺素。",
    applications: "碘酒（医用消毒）、碘化钾（碘盐，预防甲状腺肿大）、碘化银（人工降雨）、有机合成试剂。",
    funFact: "碘遇淀粉变蓝并非生成了新化合物，而是碘分子（I₂）嵌入直链淀粉螺旋通道中，改变了碘分子的电子跃迁能量，从而呈现深蓝色。",
    educationalLinks: [
      "[初中] 碘遇淀粉变蓝",
      "[高中必修] 卤素性质递变、碘的升华",
    ],
  },

  {
    atomicNumber: 54,
    symbol: "Xe",
    nameZh: "氙",
    nameEn: "Xenon",
    atomicMass: "131.29",
    category: "noble-gas",
    period: 5,
    group: 18,
    groupLabel: "0族",
    stateAtRoomTemp: "无色气体",
    density: "5.90 g/L（0°C）",
    meltingPoint: -111.75,
    boilingPoint: -108.12,
    electronegativity: 2.6,
    electronConfiguration: "[Kr] 4d¹⁰ 5s² 5p⁶",
    oxidationStates: "0, +2, +4, +6",
    chemicalProperties: "氙是第一个被证实能形成化合物的稀有气体。已知化合物有 XeF₂、XeF₄、XeF₆ 等氟化物，均为强氧化剂。XeO₃ 等含氧化合物也已被合成。",
    history: "1898 年雷姆赛和特拉弗斯发现，命名来自希腊语 xenos（陌生人）。1962 年巴特利特合成 XePtF₆，打破了稀有气体不能形成化合物的传统观念。",
    applications: "氙气灯（HID 大灯、电影放映机）、全身麻醉（医用）、离子推进器（航天）、闪光摄影。",
    funFact: "1962 年巴特利特合成了首个稀有气体化合物 XePtF₆，打破了化学界数十年的错误认知——此前人们认为稀有气体绝对不能形成化合物。",
    educationalLinks: [
      "[高中选修] 稀有气体化合物的发现是化学史上的里程碑",
    ],
  },

  {
    atomicNumber: 55,
    symbol: "Cs",
    nameZh: "铯",
    nameEn: "Cesium",
    atomicMass: "132.91",
    category: "alkali-metal",
    period: 6,
    group: 1,
    groupLabel: "IA",
    stateAtRoomTemp: "金黄色固态金属（熔点 28.44°C，近室温）",
    density: "1.873 g/cm³",
    meltingPoint: 28.44,
    boilingPoint: 671,
    electronegativity: 0.79,
    electronConfiguration: "[Xe] 6s¹",
    oxidationStates: "+1",
    chemicalProperties: "铯是电负性最低的元素（0.79），化学性质极其活泼，在空气中迅速氧化，与水反应会爆炸，甚至能与冰在低温下反应。铯金属呈金黄色，是碱金属中颜色最深的。",
    history: "1860 年本生和基尔霍夫用光谱法发现，是第一个通过光谱仪发现的元素。名称来自拉丁语 caesius（天蓝色），因其特征蓝色谱线而得名。",
    applications: "铯原子钟（精确计时，秒的定义基于铯-133）、光电管、离子推进器（航天）、钻井液（铯甲酸盐）。",
    funFact: "国际单位秒的定义基于铯-133 原子超精细跃迁频率（9,192,631,770 Hz），铯原子钟精度达每 3 亿年误差不超过 1 秒，是人类最精确的计时工具。",
    educationalLinks: [
      "[高中选修] 碱金属活泼性递变的极端",
    ],
  },

  {
    atomicNumber: 56,
    symbol: "Ba",
    nameZh: "钡",
    nameEn: "Barium",
    atomicMass: "137.33",
    category: "alkaline-earth-metal",
    period: 6,
    group: 2,
    groupLabel: "IIA",
    stateAtRoomTemp: "银白色固态金属",
    density: "3.51 g/cm³",
    meltingPoint: 727,
    boilingPoint: 1845,
    electronegativity: 0.89,
    electronConfiguration: "[Xe] 6s²",
    oxidationStates: "+2",
    chemicalProperties: "钡是活泼碱土金属，与空气、水反应。BaSO₄ 不溶于水和酸，可检验 SO₄²⁻（加稀 HNO₃ 不溶解）。Ba²⁺ 焰色反应为黄绿色。BaCO₃ 有毒，可溶于胃酸。",
    history: "1808 年戴维电解熔融氯化钡制得。名称来自希腊语 barys（重），因重晶石（BaSO₄）密度较大。",
    applications: "BaSO₄（钡餐，胃肠 X 射线造影）、白色颜料（立德粉）、焰火（黄绿色）、钡基润滑脂。",
    funFact: "钡餐检查利用 BaSO₄ 不透 X 射线且无毒（不溶于水和酸）的特性，患者服下钡餐后，胃肠轮廓在 X 光下清晰可见，是临床影像学的经典方法。",
    educationalLinks: [
      "[高中必修] Ba²⁺ 检验 SO₄²⁻",
    ],
  },

  {
    atomicNumber: 57,
    symbol: "La",
    nameZh: "镧",
    nameEn: "Lanthanum",
    atomicMass: "138.91",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "6.15 g/cm³",
    meltingPoint: 920,
    boilingPoint: 3464,
    electronegativity: 1.1,
    electronConfiguration: "[Xe] 5d¹ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1839 年莫桑德尔从铈的化合物中分离，名称来自希腊语 lanthanein（隐藏）。",
    applications: "汽车尾气催化剂、高折射率光学玻璃、镍氢电池（LaNi₅ 储氢合金）、镧钴永磁体。",
    funFact: "镧系元素之所以化学性质极为相似，是因为 4f 轨道被外层 5s²5p⁶ 电子屏蔽，各元素的外层电子构型几乎相同，导致化学行为高度一致。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 58,
    symbol: "Ce",
    nameZh: "铈",
    nameEn: "Cerium",
    atomicMass: "140.12",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "6.77 g/cm³",
    meltingPoint: 798,
    boilingPoint: 3443,
    electronegativity: 1.12,
    electronConfiguration: "[Xe] 4f¹ 5d¹ 6s²",
    oxidationStates: "+3, +4",
    chemicalProperties: "铈是地壳中最丰富的稀土元素。铈具有 +3 和 +4 两种氧化态，Ce⁴⁺ 是强氧化剂。CeO₂ 在高温下可释放和吸收氧，是汽车三元催化剂的关键储氧材料。",
    history: "1803 年贝采利乌斯和希辛格尔发现，以小行星谷神星（Ceres）命名。",
    applications: "汽车三元催化剂（CeO₂）、玻璃抛光剂（氧化铈粉）、自清洁玻璃、铈钨电极。",
    funFact: "铈是稀土元素中地壳丰度最高的，甚至比常见金属锡还丰富。CeO₂ 在催化转化器中扮演储氧库的角色，在富氧和贫氧条件之间动态调节，大幅降低尾气污染。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 59,
    symbol: "Pr",
    nameZh: "镨",
    nameEn: "Praseodymium",
    atomicMass: "140.91",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "6.77 g/cm³",
    meltingPoint: 931,
    boilingPoint: 3520,
    electronegativity: 1.13,
    electronConfiguration: "[Xe] 4f³ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1885 年冯·威尔斯巴赫从钕镨混合物中分离，名称来自希腊语 prasios（绿色）+ didymos（双胞胎）。",
    applications: "钕磁铁（NdFeB 中添加镨以提高矫顽力）、高强度镁合金、飞机发动机叶片合金、镨钕混合滤光玻璃。",
    funFact: "镨和钕在名称上有历史渊源——两者曾被误认为是同一种元素（didymium），直到 1885 年冯·威尔斯巴赫才将其分离为绿色的镨和粉红色的钕。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 60,
    symbol: "Nd",
    nameZh: "钕",
    nameEn: "Neodymium",
    atomicMass: "144.24",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "7.01 g/cm³",
    meltingPoint: 1021,
    boilingPoint: 3074,
    electronegativity: 1.14,
    electronConfiguration: "[Xe] 4f⁴ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1885 年冯·威尔斯巴赫从钕镨混合物中分离，名称来自希腊语 neos（新）+ didymos（双胞胎）。",
    applications: "NdFeB 钕磁铁（最强永磁体，用于电机、耳机、硬盘驱动器）、钕玻璃激光器、风力发电机。",
    funFact: "钕铁硼（NdFeB）磁铁是迄今最强的永磁体——一块鸡蛋大小的钕磁铁能吸住数百公斤重物。现代电动汽车和风力发电机大量依赖钕磁铁。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 61,
    symbol: "Pm",
    nameZh: "钷",
    nameEn: "Promethium",
    atomicMass: "145",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "7.26 g/cm³",
    meltingPoint: 1042,
    boilingPoint: 3000,
    electronegativity: 1.13,
    electronConfiguration: "[Xe] 4f⁵ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "钷是镧系中唯一没有稳定同位素的元素，所有同位素均具放射性。化学性质与其他镧系相似，均为 +3 价。",
    history: "1945 年马林斯基等人从铀裂变产物中分离，以希腊神话中盗火的普罗米修斯命名。",
    applications: "核电池（放射性同位素热电发生器）、早期航天器电源、荧光涂料（历史）。",
    funFact: "钷是元素周期表中第 61 号元素，也是原子序数小于 83（铋）的所有元素中唯一没有稳定同位素的一个。地球自然界中不存在钷，全部需人工制备。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 62,
    symbol: "Sm",
    nameZh: "钐",
    nameEn: "Samarium",
    atomicMass: "150.36",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "7.52 g/cm³",
    meltingPoint: 1072,
    boilingPoint: 1794,
    electronegativity: 1.17,
    electronConfiguration: "[Xe] 4f⁶ 6s²",
    oxidationStates: "+2, +3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1879 年德马尔克从矿石 samarskite 中分离，以俄国矿业官员萨马尔斯基命名——首个以人名命名的元素。",
    applications: "钐钴磁铁（SmCo，耐高温强永磁体）、核反应堆中子吸收体（¹⁴⁹Sm 截面大）、癌症靶向放射治疗。",
    funFact: "钐钴（SmCo）磁铁是钕磁铁发明前最强的永磁体，其最大优势是耐温性——在高温（>150°C）和腐蚀环境下仍能保持磁性，广泛用于航空航天电机。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 63,
    symbol: "Eu",
    nameZh: "铕",
    nameEn: "Europium",
    atomicMass: "151.96",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "5.24 g/cm³",
    meltingPoint: 822,
    boilingPoint: 1529,
    electronegativity: 1.2,
    electronConfiguration: "[Xe] 4f⁷ 6s²",
    oxidationStates: "+2, +3",
    chemicalProperties: "铕在镧系中化学活泼性较强，能以 +2 和 +3 两种氧化态稳定存在（Eu²⁺ 类似 Sr²⁺）。铕的荧光性质使其成为重要的发光材料。",
    history: "1901 年德马尔克分离，以欧洲（Europe）命名。",
    applications: "红色荧光粉（Eu³⁺ 发红光，用于 LED、液晶背光）、防伪荧光标记（欧元纸币）、彩色电视显像管红色荧光体。",
    funFact: "欧元纸币中含有铕荧光防伪标记——在紫外光照射下会发出特征红色荧光。铕是彩色显示技术的重要组成部分，使我们看到的屏幕红色更纯正。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 64,
    symbol: "Gd",
    nameZh: "钆",
    nameEn: "Gadolinium",
    atomicMass: "157.25",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "7.90 g/cm³",
    meltingPoint: 1312,
    boilingPoint: 3273,
    electronegativity: 1.2,
    electronConfiguration: "[Xe] 4f⁷ 5d¹ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "钆的热中子吸收截面是已知最大的（49000 barn），远超铀和钚。钆具有异常强的顺磁性，可作为 MRI 造影剂。",
    history: "1880 年马里尼亚克从钐矿中分离，以芬兰矿物学家加多林命名。",
    applications: "MRI 造影剂（Gd-DTPA 螯合物，增强血管和组织对比）、核反应堆中子吸收体、磁制冷材料。",
    funFact: "钆是 MRI 检查中最常用的造影剂成分——钆的七个未成对电子使其顺磁性极强，能显著缩短附近水分子的弛豫时间，令病灶在核磁共振图像中亮度突出。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 65,
    symbol: "Tb",
    nameZh: "铽",
    nameEn: "Terbium",
    atomicMass: "158.93",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "8.23 g/cm³",
    meltingPoint: 1356,
    boilingPoint: 3230,
    electronegativity: 1.2,
    electronConfiguration: "[Xe] 4f⁹ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1843 年莫桑德尔从钇矿中分离，以瑞典村庄伊特比（Ytterby）命名。",
    applications: "绿色荧光粉（Tb³⁺ 发绿光，LED 照明）、Terfenol-D 磁致伸缩材料（声纳、精密驱动器）、固体氧化物燃料电池。",
    funFact: "铽是磁致伸缩材料 Terfenol-D（铽-铁-镝合金）的核心成分——该材料在磁场中发生形变，可将电磁信号转换为机械振动，广泛用于声纳和超精密定位系统。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 66,
    symbol: "Dy",
    nameZh: "镝",
    nameEn: "Dysprosium",
    atomicMass: "162.50",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "8.55 g/cm³",
    meltingPoint: 1412,
    boilingPoint: 2567,
    electronegativity: 1.22,
    electronConfiguration: "[Xe] 4f¹⁰ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1886 年德马尔克分离，名称来自希腊语 dysprositos（难以得到）。",
    applications: "钕铁硼磁铁添加剂（提高高温矫顽力）、中子吸收体、激光材料。",
    funFact: "镝是电动汽车钕铁硼磁铁的重要添加剂——在磁铁中加入少量镝（约 1%）可使磁铁在高温下（如电机工作温度）保持强磁性，使电动汽车更高效可靠。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 67,
    symbol: "Ho",
    nameZh: "钬",
    nameEn: "Holmium",
    atomicMass: "164.93",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "8.80 g/cm³",
    meltingPoint: 1474,
    boilingPoint: 2700,
    electronegativity: 1.23,
    electronConfiguration: "[Xe] 4f¹¹ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1878 年克利夫分离，以斯德哥尔摩的拉丁语名 Holmia 命名。",
    applications: "钬激光（Ho:YAG，用于泌尿外科碎石和骨科手术）、磁场调节器（钬磁通量集中器）。",
    funFact: "钬激光（Ho:YAG 激光）是泌尿外科的重要工具，能在体内将肾结石击碎成粉末状，无需开刀，已成为腔镜碎石的标准手段。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 68,
    symbol: "Er",
    nameZh: "铒",
    nameEn: "Erbium",
    atomicMass: "167.26",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "9.07 g/cm³",
    meltingPoint: 1529,
    boilingPoint: 2868,
    electronegativity: 1.24,
    electronConfiguration: "[Xe] 4f¹² 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1843 年莫桑德尔从钇矿中分离，以伊特比（Ytterby）命名。",
    applications: "铒掺杂光纤放大器（EDFA，现代互联网光通信核心器件）、皮肤激光美容（Er:YAG）、粉红色玻璃着色。",
    funFact: "全球互联网骨干网的光信号传输依赖铒——铒掺杂光纤放大器（EDFA）能在不转换为电信号的情况下直接放大 1550 nm 光信号，使光纤通信传输距离突破数千公里。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 69,
    symbol: "Tm",
    nameZh: "铥",
    nameEn: "Thulium",
    atomicMass: "168.93",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "9.32 g/cm³",
    meltingPoint: 1545,
    boilingPoint: 1950,
    electronegativity: 1.25,
    electronConfiguration: "[Xe] 4f¹³ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镧系元素化学性质极为相似，均以 +3 氧化态为主（4f 电子被外层 5s²5p⁶ 屏蔽）。在空气中易被氧化，与水缓慢反应生成 Ln(OH)₃。",
    history: "1879 年克利夫分离，以传说中斯堪的纳维亚的古地名 Thule 命名。",
    applications: "便携式 X 射线源（¹⁷⁰Tm 放射性同位素）、铥激光（2 μm 波段，外科和激光雷达）。",
    funFact: "铥是镧系元素中最稀少且最昂贵的之一。放射性同位素 ¹⁷⁰Tm 可用作小型 X 射线源，无需电力即可拍摄 X 光片，适合野外无电力的医疗诊断。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 70,
    symbol: "Yb",
    nameZh: "镱",
    nameEn: "Ytterbium",
    atomicMass: "173.04",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "6.90 g/cm³",
    meltingPoint: 824,
    boilingPoint: 1196,
    electronegativity: 1.1,
    electronConfiguration: "[Xe] 4f¹⁴ 6s²",
    oxidationStates: "+2, +3",
    chemicalProperties: "镱的 4f 轨道已填满，在化学性质上与其他镧系略有不同，可以 +2 价（类似碱土金属）稳定存在。",
    history: "1878 年马里尼亚克从钇矿中分离，以伊特比（Ytterby）命名——该村矿山共贡献了 4 个元素的发现。",
    applications: "镱光纤激光器（Yb:fiber，1 μm 波段，工业激光加工）、镱原子钟（精度超过铯原子钟）、应力测量（镱压阻传感器）。",
    funFact: "镱原子钟的精度已超过铯原子钟，成为新一代时间标准的候选者——基于光频跃迁的镱光钟每 140 亿年误差不超过 1 秒，精度是铯钟的 1000 倍。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 71,
    symbol: "Lu",
    nameZh: "镥",
    nameEn: "Lutetium",
    atomicMass: "174.97",
    category: "lanthanide",
    period: 6,
    group: null,
    groupLabel: "镧系",
    stateAtRoomTemp: "银白色固态金属",
    density: "9.84 g/cm³",
    meltingPoint: 1663,
    boilingPoint: 3402,
    electronegativity: 1.27,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹ 6s²",
    oxidationStates: "+3",
    chemicalProperties: "镥是镧系的最后一个元素，4f 轨道完全填充。由于镧系收缩，镥的离子半径最小，在许多催化和医疗应用中表现突出。",
    history: "1907 年韦尔斯巴赫和于尔班独立分离，以巴黎的拉丁语名 Lutetia 命名。",
    applications: "PET 扫描仪探测器晶体（Lu₂SiO₅:Ce，LSO）、癌症放射治疗（¹⁷⁷Lu 标记药物）、石油裂化催化剂。",
    funFact: "医用同位素 ¹⁷⁷Lu 是肿瘤靶向放射治疗的新星——将 ¹⁷⁷Lu 标记到能与肿瘤受体结合的分子上，可将放射线精确投递到癌细胞，最大限度减少对正常组织的损伤。",
    educationalLinks: [
      "[拓展] 4f 电子填充、镧系收缩现象",
    ],
  },

  {
    atomicNumber: 72,
    symbol: "Hf",
    nameZh: "铪",
    nameEn: "Hafnium",
    atomicMass: "178.49",
    category: "transition-metal",
    period: 6,
    group: 4,
    groupLabel: "IVB",
    stateAtRoomTemp: "银灰色固态金属",
    density: "13.31 g/cm³",
    meltingPoint: 2233,
    boilingPoint: 4603,
    electronegativity: 1.3,
    electronConfiguration: "[Xe] 4f¹⁴ 5d² 6s²",
    oxidationStates: "+4",
    chemicalProperties: "铪与锆化学性质极为相似（镧系收缩导致），但中子吸收截面大（102 barn 对比锆的 0.18 barn），因此在核工业中扮演相反的角色。",
    history: "1923 年科斯特和德海韦西在哥本哈根用 X 射线光谱法发现，以哥本哈根的拉丁语名 Hafnia 命名。",
    applications: "核反应堆控制棒（高热中子吸收截面）、高介电常数栅极介质（HfO₂，先进芯片）、航空发动机高温合金。",
    funFact: "铪与锆几乎无法通过化学方法分离（镧系收缩导致性质极度相近），却在核工业中用途截然相反——锆用于核燃料包壳（透明于中子），铪用于控制棒（强烈吸收中子）。",
    educationalLinks: [
      "[拓展] 镧系收缩的实际应用",
    ],
  },

  {
    atomicNumber: 73,
    symbol: "Ta",
    nameZh: "钽",
    nameEn: "Tantalum",
    atomicMass: "180.95",
    category: "transition-metal",
    period: 6,
    group: 5,
    groupLabel: "VB",
    stateAtRoomTemp: "蓝灰色固态金属",
    density: "16.65 g/cm³",
    meltingPoint: 3017,
    boilingPoint: 5458,
    electronegativity: 1.5,
    electronConfiguration: "[Xe] 4f¹⁴ 5d³ 6s²",
    oxidationStates: "+5",
    chemicalProperties: "钽耐腐蚀性极强（仅次于铂和铱），常温下表面形成致密的 Ta₂O₅ 氧化膜。钽不溶于盐酸、硝酸、甚至王水，仅溶于氢氟酸。",
    history: "1802 年埃克贝格发现，以希腊神话中受罚的坦塔罗斯命名——因其不溶于大多数酸，如同坦塔罗斯在水中无法饮水。",
    applications: "钽电容器（手机、电脑中的滤波器）、外科植入物（人工关节、颅骨修复）、化学工业耐腐蚀设备。",
    funFact: "每部智能手机中都有钽——手机主板上密密麻麻的钽电容提供稳定的电源滤波，钽电容体积小、容量大、性能稳定，是现代电子设备不可或缺的元件。",
    educationalLinks: [],
  },

  {
    atomicNumber: 74,
    symbol: "W",
    nameZh: "钨",
    nameEn: "Tungsten",
    atomicMass: "183.84",
    category: "transition-metal",
    period: 6,
    group: 6,
    groupLabel: "VIB",
    stateAtRoomTemp: "银灰色固态金属",
    density: "19.25 g/cm³",
    meltingPoint: 3422,
    boilingPoint: 5555,
    electronegativity: 2.36,
    electronConfiguration: "[Xe] 4f¹⁴ 5d⁴ 6s²",
    oxidationStates: "+6",
    chemicalProperties: "钨的熔点是所有金属中最高的（3422°C），沸点也最高（5555°C）。钨的电阻率随温度升高而增大，是白炽灯工作原理的基础。碳化钨（WC）硬度仅次于金刚石。",
    history: "1783 年胡安和福斯托·埃尔乌亚尔兄弟首先分离，元素符号 W 来自德语 Wolfram（钨矿石名）。",
    applications: "白炽灯钨丝、硬质合金切削工具（WC-Co）、穿甲弹（钨合金）、X 射线管靶材、高温炉发热体。",
    funFact: "钨的熔点（3422°C）是所有金属中最高的，甚至超过了太阳表面温度的一半。1 克钨可以拉成约 26 公里长的细丝——正是这根细丝，点亮了人类一百多年的夜晚。",
    educationalLinks: [
      "[拓展] 熔点最高的金属",
    ],
  },

  {
    atomicNumber: 75,
    symbol: "Re",
    nameZh: "铼",
    nameEn: "Rhenium",
    atomicMass: "186.21",
    category: "transition-metal",
    period: 6,
    group: 7,
    groupLabel: "VIIB",
    stateAtRoomTemp: "银白色固态金属",
    density: "21.02 g/cm³",
    meltingPoint: 3186,
    boilingPoint: 5596,
    electronegativity: 1.9,
    electronConfiguration: "[Xe] 4f¹⁴ 5d⁵ 6s²",
    oxidationStates: "+4, +6, +7",
    chemicalProperties: "铼是熔点第二高的金属（3186°C）。铼具有宽范围的氧化态（-1 到 +7）。Re₂O₇ 是强 Lewis 酸，铼催化剂用于石油重整。",
    history: "1925 年诺达克夫妇和伯格在铂矿和铌钽矿石中发现，以莱茵河（Rhine）命名，是最后一个发现的稳定元素。",
    applications: "喷气发动机单晶叶片高温合金（含铼的镍基合金）、石油催化重整催化剂（Re-Pt/Al₂O₃）、热电偶（钨铼丝）。",
    funFact: "铼是地壳中最稀少的稳定元素之一，年产量仅约 50 吨。现代喷气发动机的单晶高温合金叶片中含铼（约 3-6%），使叶片能在超过熔点 85% 的温度下工作。",
    educationalLinks: [],
  },

  {
    atomicNumber: 76,
    symbol: "Os",
    nameZh: "锇",
    nameEn: "Osmium",
    atomicMass: "190.23",
    category: "transition-metal",
    period: 6,
    group: 8,
    groupLabel: "VIII族",
    stateAtRoomTemp: "蓝灰色固态金属",
    density: "22.59 g/cm³",
    meltingPoint: 3033,
    boilingPoint: 5012,
    electronegativity: 2.2,
    electronConfiguration: "[Xe] 4f¹⁴ 5d⁶ 6s²",
    oxidationStates: "+4, +8",
    chemicalProperties: "锇是密度最大的元素（22.59 g/cm³）。OsO₄ 是挥发性强氧化剂，有强烈刺激性气味，是有机化学中双羟化反应的重要试剂，也用于电镜生物样品染色。",
    history: "1803 年坦南特从铂矿残渣中发现，名称来自希腊语 osme（气味），因 OsO₄ 的刺鼻气味。",
    applications: "OsO₄（生物电镜染色、有机合成双羟化）、铂铱锇合金（极硬，用于钢笔笔尖、精密仪器轴承）。",
    funFact: "锇是地球上密度最大的天然元素（22.59 g/cm³），比铅重约两倍。然而其四氧化物 OsO₄ 在室温下即挥发，刺鼻气味且剧毒——密度最大的元素却有着出乎意料危险的一面。",
    educationalLinks: [],
  },

  {
    atomicNumber: 77,
    symbol: "Ir",
    nameZh: "铱",
    nameEn: "Iridium",
    atomicMass: "192.22",
    category: "transition-metal",
    period: 6,
    group: 9,
    groupLabel: "VIII族",
    stateAtRoomTemp: "银白色固态金属",
    density: "22.56 g/cm³",
    meltingPoint: 2446,
    boilingPoint: 4428,
    electronegativity: 2.2,
    electronConfiguration: "[Xe] 4f¹⁴ 5d⁷ 6s²",
    oxidationStates: "+3, +4",
    chemicalProperties: "铱是耐腐蚀性最强的金属，在高温下仍能抵抗强酸腐蚀。铱不溶于王水，仅溶于熔融盐。铱合金极为坚硬，是最硬的铂族金属。",
    history: "1803 年坦南特从铂矿残渣中发现，名称来自希腊语 iris（彩虹），因其盐类色彩丰富。",
    applications: "铂铱合金（国际千克原器、标准米尺，现已退役）、火花塞铱合金电极、铱坩埚（高温生长氧化物晶体）。",
    funFact: "白垩纪-古近纪地层中存在一层薄薄的铱异常层，铱含量是正常地壳的 30-160 倍。由于铱在地外陨石中含量远高于地壳，这被认为是 6600 万年前小行星撞击地球、导致恐龙灭绝的关键证据。",
    educationalLinks: [],
  },

  {
    atomicNumber: 78,
    symbol: "Pt",
    nameZh: "铂",
    nameEn: "Platinum",
    atomicMass: "195.08",
    category: "transition-metal",
    period: 6,
    group: 10,
    groupLabel: "VIII族",
    stateAtRoomTemp: "银白色固态金属",
    density: "21.45 g/cm³",
    meltingPoint: 1768,
    boilingPoint: 3825,
    electronegativity: 2.28,
    electronConfiguration: "[Xe] 4f¹⁴ 5d⁹ 6s¹",
    oxidationStates: "+2, +4",
    chemicalProperties: "铂是贵金属中最重要的催化剂。铂不溶于单一酸（包括浓 HNO₃），仅溶于王水（浓 HCl + 浓 HNO₃ = 3:1）。铂对 H₂、O₂、CO 等气体有强吸附催化能力。",
    history: "南美洲原住民曾使用天然铂金。18 世纪欧洲科学家系统研究，名称来自西班牙语 platina（小银子）。",
    applications: "汽车三元催化转化器（Pt/Pd/Rh）、燃料电池催化剂（铂碳）、石化催化重整、铂金珠宝、顺铂（抗癌药）。",
    funFact: "全球约 40% 的铂用于汽车尾气催化转化器，将有毒的 CO 和 NOₓ 转化为无害的 CO₂ 和 N₂。一辆现代汽车的三元催化器中大约含有 3-7 克铂族金属。",
    educationalLinks: [
      "[高中选修] 王水溶解 Au/Pt；燃料电池催化剂",
    ],
  },

  {
    atomicNumber: 79,
    symbol: "Au",
    nameZh: "金",
    nameEn: "Gold",
    atomicMass: "196.97",
    category: "transition-metal",
    period: 6,
    group: 11,
    groupLabel: "IB",
    stateAtRoomTemp: "金黄色固态金属",
    density: "19.32 g/cm³",
    meltingPoint: 1064,
    boilingPoint: 2856,
    electronegativity: 2.54,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s¹",
    oxidationStates: "+1, +3",
    chemicalProperties: "金是化学稳定性最强的金属之一，在自然界以单质存在。金不溶于任何单一酸，仅溶于王水（3HCl + HNO₃）。金的延展性极好——1 克金可拉成 3000 米金丝，或锤成 0.5 m² 金箔。",
    history: "人类最早使用的金属之一，在古埃及、中国、美索不达米亚等文明中均有数千年使用历史。元素符号 Au 来自拉丁语 aurum。",
    applications: "珠宝货币、电子设备金触点（高导电性和抗氧化）、牙科材料、纳米金颗粒（医学诊断）、顺铂类抗癌药物前体。",
    funFact: "纳米金颗粒并非金黄色，而是红色、橙色或紫色——颗粒尺寸决定其颜色，因为不同粒径对光的等离子共振吸收波长不同。中世纪教堂彩色玻璃的红色正是来自玻璃中的纳米金颗粒。",
    educationalLinks: [
      "[高中选修] 王水溶解金、胶体知识",
    ],
  },

  {
    atomicNumber: 80,
    symbol: "Hg",
    nameZh: "汞",
    nameEn: "Mercury",
    atomicMass: "200.59",
    category: "transition-metal",
    period: 6,
    group: 12,
    groupLabel: "IIB",
    stateAtRoomTemp: "液态金属（常温下唯一液态金属）",
    density: "13.53 g/cm³",
    meltingPoint: -38.83,
    boilingPoint: 356.73,
    electronegativity: 2.0,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s²",
    oxidationStates: "+1, +2",
    chemicalProperties: "汞是常温下唯一的液态金属（熔点-38.83°C）。汞蒸气有毒，有机汞（甲基汞）毒性更强。汞能溶解许多金属形成汞齐。汞不与稀酸反应，与浓 HNO₃ 反应生成 Hg(NO₃)₂。",
    history: "人类使用汞有数千年历史。中国古代称水银，认为有长生功效。名称 Mercury 来自罗马神墨丘利，元素符号 Hg 来自拉丁语 hydrargyrum（液态银）。",
    applications: "温度计（正在淘汰）、气压计、荧光灯（汞蒸气放电）、氯碱工业（汞电极，已逐步淘汰）、牙科汞合金。",
    funFact: "日本水俣病是 20 世纪最严重的公害事件之一——化工厂将含汞废水排入水俣湾，汞在食物链中富集为甲基汞，渔民长期食用受污染的鱼后出现严重神经系统损伤，揭示了重金属污染的可怕危害。",
    educationalLinks: [
      "[初中] 温度计中的汞",
      "[高中选修] 重金属污染",
    ],
  },

  {
    atomicNumber: 81,
    symbol: "Tl",
    nameZh: "铊",
    nameEn: "Thallium",
    atomicMass: "204.38",
    category: "post-transition-metal",
    period: 6,
    group: 13,
    groupLabel: "IIIA",
    stateAtRoomTemp: "银白色固态金属",
    density: "11.85 g/cm³",
    meltingPoint: 304,
    boilingPoint: 1473,
    electronegativity: 1.62,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹",
    oxidationStates: "+1, +3",
    chemicalProperties: "铊是剧毒重金属，Tl⁺ 离子与 K⁺ 尺寸相近，能欺骗生物体的钾通道，干扰神经传导。铊的化合物无色无味，难以察觉。",
    history: "1861 年克鲁克斯用光谱法发现，名称来自希腊语 thallos（绿枝），因其特征绿色谱线。",
    applications: "CdZnTe 核辐射探测器（掺铊）、心脏核医学成像（²⁰¹Tl）、红外光学玻璃（KRS-5 晶体）。",
    funFact: "铊盐曾被用作毒鼠药（无色无味，低剂量即致死），因其极易被人误用，大多数国家已全面禁止。铊中毒最典型的症状是头发全部脱落，被称为重金属毒物中的隐形杀手。",
    educationalLinks: [],
  },

  {
    atomicNumber: 82,
    symbol: "Pb",
    nameZh: "铅",
    nameEn: "Lead",
    atomicMass: "207.2",
    category: "post-transition-metal",
    period: 6,
    group: 14,
    groupLabel: "IVA",
    stateAtRoomTemp: "蓝灰色固态金属",
    density: "11.34 g/cm³",
    meltingPoint: 327.46,
    boilingPoint: 1749,
    electronegativity: 2.33,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²",
    oxidationStates: "+2, +4",
    chemicalProperties: "铅是质软、密度大的重金属。铅的 6s² 孤对电子效应（惰性电子对效应）使 +2 价更稳定。铅对 X 射线和 γ 射线有很强的屏蔽作用。PbSO₄ 和 PbO₂ 是铅蓄电池的关键材料。",
    history: "人类最早使用的金属之一，古罗马广泛用铅制水管和酒器（铅中毒可能影响了罗马帝国的命运）。元素符号 Pb 来自拉丁语 plumbum。",
    applications: "铅蓄电池（汽车启动电池）、辐射防护（X 射线/γ 射线屏蔽）、子弹/弹头、铅玻璃（光学）。",
    funFact: "古罗马人用铅锅烹饪、用铅管输水，甚至用含铅的醋酸铅（铅糖）来增甜葡萄酒。历史学家认为慢性铅中毒可能是影响罗马贵族健康和决策的因素之一。",
    educationalLinks: [
      "[高中必修] 铅蓄电池",
    ],
  },

  {
    atomicNumber: 83,
    symbol: "Bi",
    nameZh: "铋",
    nameEn: "Bismuth",
    atomicMass: "208.98",
    category: "post-transition-metal",
    period: 6,
    group: 15,
    groupLabel: "VA",
    stateAtRoomTemp: "银白色带粉红光泽固体",
    density: "9.78 g/cm³",
    meltingPoint: 271.5,
    boilingPoint: 1564,
    electronegativity: 2.02,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³",
    oxidationStates: "+3, +5",
    chemicalProperties: "铋是密度最大的稳定无毒金属。铋在凝固时体积膨胀（类似冰），与大多数金属相反。铋的氧化物呈现丰富色彩。",
    history: "15 世纪已有记载，长期与铅和锡混淆。名称来源有争议，可能来自德语 Wismut。1753 年热弗鲁瓦证明铋是独立元素。",
    applications: "次水杨酸铋（胃药，碧然德）、低熔点合金（Bi-Pb-Sn，保险丝、焊料）、铋黄色颜料（替代有毒铬黄）、热电材料。",
    funFact: "铋晶体拥有极为美丽的彩虹色氧化层——由于铋的薄氧化层厚度不均，干涉光形成从金色到蓝紫色的结构色渐变，使每一块铋晶体都像独一无二的彩色宝石。",
    educationalLinks: [],
  },

  {
    atomicNumber: 84,
    symbol: "Po",
    nameZh: "钋",
    nameEn: "Polonium",
    atomicMass: "209",
    category: "post-transition-metal",
    period: 6,
    group: 16,
    groupLabel: "VIA",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "9.32 g/cm³",
    meltingPoint: 254,
    boilingPoint: 962,
    electronegativity: 2.0,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴",
    oxidationStates: "+2, +4",
    chemicalProperties: "钋是强放射性元素，主要衰变方式为 α 衰变。²¹⁰Po 的比放射性极高，微克量级即可造成致命辐射剂量。钋产生的辐射热使其表面温度可升至数百度。",
    history: "1898 年居里夫妇从沥青铀矿中发现，以居里夫人的祖国波兰（Polonia）命名，是首个以国家命名的元素。",
    applications: "静电消除器（²¹⁰Po α 射线电离空气，工业用）、早期核武器点火中子源（钋-铍中子源）。",
    funFact: "2006 年前俄罗斯特工亚历山大·利特维年科在伦敦被 ²¹⁰Po 毒杀，这是有记录以来首例使用钋实施谋杀的案件。²¹⁰Po 几乎不发射 γ 射线，难以被常规探测仪发现，是极为隐蔽的毒药。",
    educationalLinks: [],
  },

  {
    atomicNumber: 85,
    symbol: "At",
    nameZh: "砹",
    nameEn: "Astatine",
    atomicMass: "210",
    category: "halogen",
    period: 6,
    group: 17,
    groupLabel: "VIIA",
    stateAtRoomTemp: "黑色固体（推测，放射性）",
    density: "—",
    meltingPoint: 302,
    boilingPoint: 337,
    electronegativity: 2.2,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵",
    oxidationStates: "-1, +1, +3, +5",
    chemicalProperties: "砹是最重的卤素，也是自然界最稀少的天然元素。其化学性质推测与碘相似，但金属性更强。由于半衰期极短，其化学性质难以精确研究。",
    history: "1940 年科森、麦肯齐和西格雷在伯克利用 α 粒子轰击铋合成，名称来自希腊语 astatos（不稳定）。",
    applications: "癌症靶向放射治疗（²¹¹At 标记抗体，α 射线精确杀死肿瘤细胞）。",
    funFact: "地球上所有天然砹加在一起，任意时刻的总量不超过 1 克。它是通过铀和钍的天然衰变链微量生成的，但很快又衰变消失。",
    educationalLinks: [],
  },

  {
    atomicNumber: 86,
    symbol: "Rn",
    nameZh: "氡",
    nameEn: "Radon",
    atomicMass: "222",
    category: "noble-gas",
    period: 6,
    group: 18,
    groupLabel: "0族",
    stateAtRoomTemp: "无色放射性气体",
    density: "9.73 g/L（0°C）",
    meltingPoint: -71,
    boilingPoint: -61.7,
    electronegativity: null,
    electronConfiguration: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶",
    oxidationStates: "0",
    chemicalProperties: "氡是唯一天然放射性稀有气体，所有同位素均有放射性。氡由镭衰变产生，α 衰变链中的中间产物。目前已合成少量 RnF₂ 化合物。",
    history: "1900 年道恩从镭的衰变产物中发现。1908 年冉姆赛确认为新元素，命名 radium emanation，后简化为 radon。",
    applications: "氡疗（历史上争议用法）、物理研究、地震前兆监测（地壳氡释放异常）。",
    funFact: "室内氡积累是仅次于吸烟的第二大肺癌诱因。氡从岩石和土壤中渗入地下室，在通风不良的房间中浓缩，长期暴露会显著增加肺癌风险——购买房屋前检测氡浓度已成为许多国家的常规建议。",
    educationalLinks: [],
  },

  {
    atomicNumber: 87,
    symbol: "Fr",
    nameZh: "钫",
    nameEn: "Francium",
    atomicMass: "223",
    category: "alkali-metal",
    period: 7,
    group: 1,
    groupLabel: "IA",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "—",
    meltingPoint: 27,
    boilingPoint: 677,
    electronegativity: 0.7,
    electronConfiguration: "[Rn] 7s¹",
    oxidationStates: "+1",
    chemicalProperties: "钫是最不稳定的天然碱金属，最长寿命同位素 ²²³Fr 半衰期仅 22 分钟。理论上应是活泼性最强的碱金属，但因数量极少，其化学性质几乎无法直接研究。",
    history: "1939 年法国物理学家玛格丽特·佩雷在放射性衰变产物中发现，以法国（France）命名——也是最后一个被发现的天然元素。",
    applications: "基础物理研究（激光冷却钫原子测量弱相互作用）。",
    funFact: "钫是人类发现的最后一个天然存在的元素（1939 年）。地球上任意时刻自然存在的钫总量估计不超过 30 克——全部来自铀和钍的衰变链，且不断生成又不断衰变。",
    educationalLinks: [],
  },

  {
    atomicNumber: 88,
    symbol: "Ra",
    nameZh: "镭",
    nameEn: "Radium",
    atomicMass: "226",
    category: "alkaline-earth-metal",
    period: 7,
    group: 2,
    groupLabel: "IIA",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "5.0 g/cm³",
    meltingPoint: 700,
    boilingPoint: 1737,
    electronegativity: 0.9,
    electronConfiguration: "[Rn] 7s²",
    oxidationStates: "+2",
    chemicalProperties: "镭是放射性最强的天然元素之一，α/β/γ 射线俱全。镭的放射性热量使其在黑暗中发出蓝色荧光。化学性质类似钡，BaSO₄ 共沉淀法可从矿石中富集镭。",
    history: "1898 年居里夫妇从沥青铀矿中发现，名称来自拉丁语 radius（射线）。居里夫人因研究放射性两度获诺贝尔奖，是唯一获得两个不同学科诺贝尔奖的科学家。",
    applications: "早期放射治疗（肿瘤，已被更安全的同位素取代）、早期钟表和仪表夜光涂料（已禁止）。",
    funFact: "早期镭被宣传为包治百病的神奇物质——添加镭的饮用水、牙膏、化妆品甚至巧克力曾风靡一时。20 世纪初的表盘女工因用嘴舔笔尖涂镭发光漆而患颌骨坏死和白血病，其诉讼案成为工人安全权益的历史里程碑。",
    educationalLinks: [
      "[高中选修] 放射性发现史",
    ],
  },

  {
    atomicNumber: 89,
    symbol: "Ac",
    nameZh: "锕",
    nameEn: "Actinium",
    atomicMass: "227",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "10.07 g/cm³",
    meltingPoint: 1050,
    boilingPoint: 3200,
    electronegativity: 1.1,
    electronConfiguration: "[Rn] 6d¹ 7s²",
    oxidationStates: "+3",
    chemicalProperties: "锕是锕系之首，化学性质与镧相似，主要以 +3 价存在。锕的放射性较强，发出蓝色辉光（切伦科夫辐射）。",
    history: "1899 年德比耶纳从沥青铀矿中发现，名称来自希腊语 aktis（射线）。",
    applications: "²²⁷Ac 中子源、²²⁵Ac 靶向 α 治疗癌症（新型放射性药物）。",
    funFact: "锕在黑暗中发出幽蓝色辉光——这不是荧光，而是其放射性衰变粒子使周围空气电离发光的切伦科夫辐射，就像核反应堆水池中著名的蓝色光晕。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 90,
    symbol: "Th",
    nameZh: "钍",
    nameEn: "Thorium",
    atomicMass: "232.04",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "11.72 g/cm³",
    meltingPoint: 1750,
    boilingPoint: 4788,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 6d² 7s²",
    oxidationStates: "+4",
    chemicalProperties: "钍是地壳中最丰富的锕系元素，比铀丰度高约 3 倍。²³²Th 是可增殖核材料，在快中子反应堆中可转化为 ²³³U（可裂变）。",
    history: "1829 年贝采利乌斯发现，以北欧战神托尔（Thor）命名。",
    applications: "钍基核燃料循环（研究阶段）、高温气体冷却堆燃料、氧化钍高强度耐火材料、钨钍合金电极。",
    funFact: "钍的地球储量约是铀的 3 倍，且钍反应堆产生的核废料量更少、半衰期更短，被视为未来核能的重要方向。印度因拥有大量钍矿，正积极推进钍基核燃料研究。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 91,
    symbol: "Pa",
    nameZh: "镤",
    nameEn: "Protactinium",
    atomicMass: "231.04",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "15.37 g/cm³",
    meltingPoint: 1568,
    boilingPoint: 4027,
    electronegativity: 1.5,
    electronConfiguration: "[Rn] 5f² 6d¹ 7s²",
    oxidationStates: "+4, +5",
    chemicalProperties: "镤是锕衰变链的一部分，²³¹Pa 是 ²³⁵U 衰变系中的成员。高毒性，放射性强，无实际工业用途。",
    history: "1917 年迈特纳和哈恩、索迪和克兰斯顿分别独立发现。名称来自希腊语 protos（第一）+ actinium，意为锕的前体。",
    applications: "地质年代学（²³¹Pa/²³⁰Th 比值测定古海洋流速）、基础核物理研究。",
    funFact: "镤是极为稀少且剧毒的元素，全球总积累量不超过 125 克（用于核研究）。其名称意为锕的前身，因为 ²³¹Pa 通过 α 衰变生成 ²²⁷Ac。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 92,
    symbol: "U",
    nameZh: "铀",
    nameEn: "Uranium",
    atomicMass: "238.03",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银灰色固态金属（放射性）",
    density: "18.95 g/cm³",
    meltingPoint: 1132,
    boilingPoint: 4131,
    electronegativity: 1.38,
    electronConfiguration: "[Rn] 5f³ 6d¹ 7s²",
    oxidationStates: "+4, +6",
    chemicalProperties: "天然铀含 ²³⁵U（0.72%，可裂变）和 ²³⁸U（99.27%）。²³⁵U 吸收热中子发生链式裂变反应，释放巨大能量。铀的化学活泼性高，在空气中慢慢氧化，与酸反应。",
    history: "1789 年克拉普罗特从沥青铀矿中发现，以天王星（Uranus）命名。1938 年哈恩、迈特纳和斯特拉斯曼发现核裂变。",
    applications: "核电站燃料（低浓缩铀，²³⁵U 3-5%）、核武器（高浓缩铀，²³⁵U >90%）、贫铀穿甲弹（²³⁸U，密度极大）。",
    funFact: "核裂变链式反应：一个 ²³⁵U 核分裂释放约 200 MeV 能量——1 千克铀裂变释放的能量相当于燃烧约 3000 吨煤。全球 10% 以上的电力来自铀裂变，是现实中最密集的能量来源之一。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 93,
    symbol: "Np",
    nameZh: "镎",
    nameEn: "Neptunium",
    atomicMass: "237",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "20.45 g/cm³",
    meltingPoint: 644,
    boilingPoint: 3902,
    electronegativity: 1.36,
    electronConfiguration: "[Rn] 5f⁴ 6d¹ 7s²",
    oxidationStates: "+4, +5",
    chemicalProperties: "镎是第一个超铀元素，由人工核反应制备。化学性质与铀相近，可形成 +3 到 +7 多种氧化态，其中 +5 最稳定。",
    history: "1940 年麦克米伦和阿贝尔森在伯克利用中子轰击铀制备，以海王星（Neptune）命名——铀以天王星命名，故下一个以海王星命名。",
    applications: "²³⁷Np 可转化为 ²³⁸Pu（用于放射性同位素热电发生器的燃料）、中子探测器。",
    funFact: "镎是人类合成的第一个超铀元素，开启了人工制造新元素的时代。²³⁷Np 是核废料的重要成分之一，其半衰期约 214 万年，是长期核废料管理的挑战之一。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 94,
    symbol: "Pu",
    nameZh: "钚",
    nameEn: "Plutonium",
    atomicMass: "244",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "19.84 g/cm³",
    meltingPoint: 640,
    boilingPoint: 3228,
    electronegativity: 1.28,
    electronConfiguration: "[Rn] 5f⁶ 7s²",
    oxidationStates: "+3, +4",
    chemicalProperties: "²³⁹Pu 是可裂变材料，在反应堆中由 ²³⁸U 吸收中子后生成。钚化学活泼，具有 +3 到 +7 多种氧化态，在溶液中可同时呈现 4 种氧化态（罕见）。",
    history: "1940 年西博格、麦克米伦等人合成，以冥王星（Pluto）命名。曼哈顿计划中大规模生产用于原子弹。",
    applications: "核武器弹芯（²³⁹Pu）、核反应堆燃料（MOX 混合氧化物燃料）、深空探测器电源（²³⁸Pu 放射性同位素热电发生器，如旅行者号、卡西尼号）。",
    funFact: "旅行者 1 号、好奇号火星车等深空探测器的能源来自 ²³⁸Pu——每克 ²³⁸Pu 衰变释放约 0.57 瓦热量，这种长寿命且稳定的能量来源使探测器能在远离太阳、无法使用太阳能板的地方工作数十年。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 95,
    symbol: "Am",
    nameZh: "镅",
    nameEn: "Americium",
    atomicMass: "243",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "13.67 g/cm³",
    meltingPoint: 1176,
    boilingPoint: 2607,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f⁷ 7s²",
    oxidationStates: "+3",
    chemicalProperties: "镅是较常见的超铀元素，可在核反应堆中由钚吸收中子后大量生成。²⁴¹Am 发射 α 射线和低能 γ 射线，化学性质与稀土相似。",
    history: "1944 年西博格等人在芝加哥冶金实验室合成，以美洲（Americas）命名。",
    applications: "家用烟雾探测器（²⁴¹Am α 射线电离空气，烟雾阻断电离电流即触发报警）、工业厚度测量。",
    funFact: "几乎每个家庭都有含镅的设备——普通烟雾探测器中装有约 0.9 微克 ²⁴¹Am，其 α 射线电离空气形成微小电流，当烟雾进入电离室时阻断电流，触发报警，每年拯救无数生命。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 96,
    symbol: "Cm",
    nameZh: "锔",
    nameEn: "Curium",
    atomicMass: "247",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "银白色固态金属（放射性）",
    density: "13.51 g/cm³",
    meltingPoint: 1340,
    boilingPoint: 3110,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f⁷ 6d¹ 7s²",
    oxidationStates: "+3",
    chemicalProperties: "锔与钆（64）类似，4f⁷/5f⁷ 半充满构型赋予其特殊稳定性，主要以 +3 价存在。放射性较强，操作需特殊防护。",
    history: "1944 年西博格和吉奥尔索等人合成，以居里夫妇（Pierre 和 Marie Curie）命名，以表彰其对放射性研究的伟大贡献。",
    applications: "²⁴⁴Cm α 源（用于 α 粒子 X 射线荧光光谱仪，如火星探测器）、核电池。",
    funFact: "好奇号火星车上搭载了含锔的仪器 APXS（α 粒子 X 射线光谱仪），利用 ²⁴⁴Cm 的 α 射线照射岩石，通过分析反射 X 射线来确定火星岩石的元素组成。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 97,
    symbol: "Bk",
    nameZh: "锫",
    nameEn: "Berkelium",
    atomicMass: "247",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "14.78 g/cm³",
    meltingPoint: 986,
    boilingPoint: 2627,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f⁹ 7s²",
    oxidationStates: "+3",
    chemicalProperties: "锫化学性质与镅、锔相似，主要以 +3 价存在。因产量极微，化学研究非常有限。",
    history: "1949 年汤普森、吉奥尔索和西博格在伯克利合成，以发现地伯克利（Berkeley）命名。",
    applications: "用于合成更重的超铀元素（锫-249 靶材用于合成元素 97 以后的元素）。",
    funFact: "锫-249 是合成超重元素的重要靶材——2010 年合成第 117 号元素（鿬）时，用 ²⁴⁹Bk 靶被钙-48 离子轰击，制备了仅约 13 毫克的锫-249 就花费了多年时间。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 98,
    symbol: "Cf",
    nameZh: "锎",
    nameEn: "Californium",
    atomicMass: "251",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "15.1 g/cm³",
    meltingPoint: 900,
    boilingPoint: 1745,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f¹⁰ 7s²",
    oxidationStates: "+3",
    chemicalProperties: "锎是少数有实际工业应用的超铀元素，²⁵²Cf 每分钟自发裂变释放大量中子（约 2.3×10¹² 中子/克·秒）。",
    history: "1950 年汤普森等人在加州大学伯克利分校合成，以加利福尼亚州（California）命名。",
    applications: "中子源（启动核反应堆、石油井测井、癌症硼中子俘获治疗）、金属探测（中子活化分析）。",
    funFact: "²⁵²Cf 是世界上最昂贵的物质之一，价格约每微克 2700 美元（约每克 27 亿美元）。其强中子发射能力使其成为唯一可实际商业使用的超铀元素。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 99,
    symbol: "Es",
    nameZh: "锿",
    nameEn: "Einsteinium",
    atomicMass: "252",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "8.84 g/cm³",
    meltingPoint: 860,
    boilingPoint: 996,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f¹¹ 7s²",
    oxidationStates: "+3",
    chemicalProperties: "锿以 +3 价为主，可在溶液中研究其化学性质，但产量极微（微克级）。",
    history: "1952 年美国科学家在第一颗氢弹（常青藤麦克）爆炸的放射性尘降物中发现，以爱因斯坦（Einstein）命名。发现消息保密数年。",
    applications: "基础核科学研究，用于合成更重的超铀元素。",
    funFact: "锿是在氢弹爆炸的灰烬中被发现的——1952 年常青藤麦克氢弹试验后，科学家从放射性尘降物中秘密分离出锿和镄，相关研究保密了数年才公开。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 100,
    symbol: "Fm",
    nameZh: "镄",
    nameEn: "Fermium",
    atomicMass: "257",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "—",
    meltingPoint: 1527,
    boilingPoint: 0,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f¹² 7s²",
    oxidationStates: "+3",
    chemicalProperties: "镄同样在氢弹爆炸尘降物中发现。因产量极微（皮克级），几乎所有性质均为理论预测。",
    history: "1952 年与锿同时在氢弹爆炸尘降物中发现，以恩里科·费米（Enrico Fermi）命名。",
    applications: "目前仅用于基础核物理研究。",
    funFact: "镄是最后一个可通过中子俘获从宏观量铀/钚出发合成的元素——101 号以后的元素必须用粒子加速器轰击重核才能合成，每次只能产生极少数原子，无法积累宏观量。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 101,
    symbol: "Md",
    nameZh: "钔",
    nameEn: "Mendelevium",
    atomicMass: "258",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "—",
    meltingPoint: 827,
    boilingPoint: 0,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f¹³ 7s²",
    oxidationStates: "+3",
    chemicalProperties: "钔是首个用加速器离子轰击（而非中子俘获）合成的元素。每次实验仅产生约 1-3 个钔原子，性质极难研究。",
    history: "1955 年吉奥尔索等人用氦核轰击锿合成，以门捷列夫（Mendeleev）命名，以表彰其创建元素周期表的伟大贡献。",
    applications: "基础核物理研究。",
    funFact: "钔是以门捷列夫命名的元素——正是门捷列夫于 1869 年创建的元素周期表预言了未知元素的存在，指导了后来所有元素的发现，这个以他名字命名的元素是对其科学遗产的致敬。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 102,
    symbol: "No",
    nameZh: "锘",
    nameEn: "Nobelium",
    atomicMass: "259",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "—",
    meltingPoint: 827,
    boilingPoint: 0,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f¹⁴ 7s²",
    oxidationStates: "+2, +3",
    chemicalProperties: "锘在镧系/锕系中较特殊，+2 价（5f¹⁴ 全充满稳定）与 +3 价竞争，在稀土化学中 Md²⁺ 和 No²⁺ 具有特殊意义。",
    history: "1958 年苏联杜布纳实验室和美国伯克利实验室分别声称发现，以阿尔弗雷德·诺贝尔（Nobel）命名。",
    applications: "基础核物理研究。",
    funFact: "锘的命名曾引发国际争议——苏联和美国科学家都声称优先发现权，争执持续多年，最终 IUPAC 于 1994 年正式裁定该元素以诺贝尔命名。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 103,
    symbol: "Lr",
    nameZh: "铹",
    nameEn: "Lawrencium",
    atomicMass: "262",
    category: "actinide",
    period: 7,
    group: null,
    groupLabel: "锕系",
    stateAtRoomTemp: "放射性固态金属（推测）",
    density: "—",
    meltingPoint: 1627,
    boilingPoint: 0,
    electronegativity: 1.3,
    electronConfiguration: "[Rn] 5f¹⁴ 7s² 7p¹",
    oxidationStates: "+3",
    chemicalProperties: "铹是锕系的最后一个元素，5f 轨道完全填充。理论预测其 7p¹ 外层电子使其性质偏离典型锕系规律。",
    history: "1961 年吉奥尔索等人在伯克利用硼轰击锎合成，以欧内斯特·劳伦斯（E.O. Lawrence，回旋加速器发明者）命名。",
    applications: "基础核物理研究。",
    funFact: "铹是锕系元素的最后一个，也是 f 区元素的终结。从 57 号镧到 103 号铹，这 32 个 f 区元素跨越两排，象征着量子力学对元素化学的深刻描述——每一行对应一组角动量量子数 l=3 的 f 轨道填充。",
    educationalLinks: [
      "[高中选修] 核裂变与核聚变原理、放射性",
    ],
  },

  {
    atomicNumber: 104,
    symbol: "Rf",
    nameZh: "𨧀",
    nameEn: "Rutherfordium",
    atomicMass: "267",
    category: "transition-metal",
    period: 7,
    group: 4,
    groupLabel: "IVB",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d² 7s²",
    oxidationStates: "+4",
    chemicalProperties: "超重过渡金属，理论上应与铪化学性质相似（同族）。已进行少量化学实验，证实其 +4 氧化态。",
    history: "1964 年苏联杜布纳实验室和 1969 年美国伯克利实验室分别合成，1997 年 IUPAC 正式命名，以欧内斯特·卢瑟福命名。",
    applications: "基础核物理研究，无实际应用。",
    funFact: "从 104 号元素起，所有元素均为人工合成，半衰期从毫秒到几分钟不等。它们通过重离子加速器将较轻的核撞击在一起产生，每次实验可能只产生几个原子。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 105,
    symbol: "Db",
    nameZh: "𨭎",
    nameEn: "Dubnium",
    atomicMass: "268",
    category: "transition-metal",
    period: 7,
    group: 5,
    groupLabel: "VB",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d³ 7s²",
    oxidationStates: "+5",
    chemicalProperties: "理论上应与钽（同族）化学性质相似，已证实其 +5 氧化态。",
    history: "1968 年苏联杜布纳实验室和 1970 年美国伯克利合成，1997 年 IUPAC 以俄罗斯杜布纳（Dubna）命名。",
    applications: "基础核物理研究。",
    funFact: "杜布纳是俄罗斯核物理研究中心所在地，苏联和美国科学家在冷战期间竞相合成超重元素，这场竞争被称为超重元素的发现之争，最终由 IUPAC 仲裁命名。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 106,
    symbol: "Sg",
    nameZh: "𨭆",
    nameEn: "Seaborgium",
    atomicMass: "269",
    category: "transition-metal",
    period: 7,
    group: 6,
    groupLabel: "VIB",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d⁴ 7s²",
    oxidationStates: "+6",
    chemicalProperties: "理论上应与钨（同族）化学性质相似，是首批经过化学研究的超重元素之一。",
    history: "1974 年苏联杜布纳和美国伯克利合成，以格伦·西博格（Glenn Seaborg，镎和后续超铀元素的共同发现者）命名——首个以在世科学家命名的元素。",
    applications: "基础核物理研究。",
    funFact: "格伦·西博格是历史上唯一一位以在世状态看到以自己命名的元素被正式确认的科学家。西博格一生参与发现了 10 个超铀元素，是核化学史上贡献最大的科学家之一。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 107,
    symbol: "Bh",
    nameZh: "𨨏",
    nameEn: "Bohrium",
    atomicMass: "270",
    category: "transition-metal",
    period: 7,
    group: 7,
    groupLabel: "VIIB",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d⁵ 7s²",
    oxidationStates: "+7",
    chemicalProperties: "理论上应与铼（同族）化学性质相似。",
    history: "1981 年德国 GSI 合成，以尼尔斯·玻尔（Niels Bohr，量子力学奠基人）命名。",
    applications: "基础核物理研究。",
    funFact: "玻尔于 1913 年提出氢原子的玻尔模型，用量子化轨道解释了氢的发射光谱，是量子力学发展的关键一步。以他命名的元素位于第七周期，象征着从经典到量子物理的跨越。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 108,
    symbol: "Hs",
    nameZh: "𨭆",
    nameEn: "Hassium",
    atomicMass: "277",
    category: "transition-metal",
    period: 7,
    group: 8,
    groupLabel: "VIII族",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d⁶ 7s²",
    oxidationStates: "+8",
    chemicalProperties: "理论上应与锇（同族）相似，OsO₄ 类比物 HsO₄ 已被实验证实，显示超重元素仍遵循周期律。",
    history: "1984 年德国黑森州 GSI 合成，以黑森（Hessen）的拉丁语名 Hassia 命名。",
    applications: "基础核物理研究。",
    funFact: "科学家已成功合成并研究了 HsO₄ 分子，证明 108 号元素确实与同族的锇（76）性质相似——这是相对论量子化学预测和实验的重要验证，说明即使超重元素也服从周期律。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 109,
    symbol: "Mt",
    nameZh: "鿏",
    nameEn: "Meitnerium",
    atomicMass: "278",
    category: "transition-metal",
    period: 7,
    group: 9,
    groupLabel: "VIII族",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d⁷ 7s²",
    oxidationStates: "+6",
    chemicalProperties: "理论上应与铱（同族）化学性质相似，但尚无实验验证。",
    history: "1982 年德国 GSI 合成，以莉泽·迈特纳（Lise Meitner，核裂变的理论阐释者）命名。",
    applications: "基础核物理研究。",
    funFact: "莉泽·迈特纳是核裂变的重要发现者之一，却因性别歧视未能与哈恩共同获得 1944 年诺贝尔奖，被诺贝尔委员会忽视。109 号元素以她命名，是科学史上迟来的认可。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 110,
    symbol: "Ds",
    nameZh: "鐽",
    nameEn: "Darmstadtium",
    atomicMass: "281",
    category: "transition-metal",
    period: 7,
    group: 10,
    groupLabel: "VIII族",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d⁸ 7s²",
    oxidationStates: "+6",
    chemicalProperties: "理论上应与铂（同族）化学性质相似，无实验验证。",
    history: "1994 年德国达姆施塔特 GSI 合成，以发现地达姆施塔特（Darmstadt）命名。",
    applications: "基础核物理研究。",
    funFact: "GSI（亥姆霍兹重离子研究中心）位于德国达姆施塔特，是超重元素研究的重要基地，先后发现了从 107 到 112 号共 6 个元素，以一地之名命名其中一个，可谓实至名归。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 111,
    symbol: "Rg",
    nameZh: "錀",
    nameEn: "Roentgenium",
    atomicMass: "282",
    category: "transition-metal",
    period: 7,
    group: 11,
    groupLabel: "IB",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s¹",
    oxidationStates: "+3",
    chemicalProperties: "理论上应与金（同族）化学性质相似，相对论效应预测其化学性质可能更接近铊。",
    history: "1994 年德国 GSI 合成，以威廉·伦琴（Wilhelm Röntgen，X 射线发现者）命名。",
    applications: "基础核物理研究。",
    funFact: "伦琴于 1895 年发现 X 射线，并因此获得第一届诺贝尔物理学奖（1901 年）。伦琴拒绝为 X 射线申请专利，使其免费用于医学——以他名字命名的元素是对这种无私精神的永久纪念。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 112,
    symbol: "Cn",
    nameZh: "鎶",
    nameEn: "Copernicium",
    atomicMass: "285",
    category: "transition-metal",
    period: 7,
    group: 12,
    groupLabel: "IIB",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s²",
    oxidationStates: "+2",
    chemicalProperties: "理论上应与汞（同族）相似，但相对论效应极强，预测其 7s 轨道大幅收缩，常温下可能为气态。",
    history: "1996 年德国 GSI 合成，2010 年 IUPAC 正式命名，以尼古拉·哥白尼（Copernicus）命名。",
    applications: "基础核物理研究。",
    funFact: "鎶可能是元素周期表中第一个在室温下呈气态的金属——相对论量子力学计算显示，112 号元素因相对论效应使 7s 轨道强烈收缩，原子间结合力极弱，沸点可能低于室温，是真正的相对论元素。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 113,
    symbol: "Nh",
    nameZh: "鉨",
    nameEn: "Nihonium",
    atomicMass: "286",
    category: "post-transition-metal",
    period: 7,
    group: 13,
    groupLabel: "IIIA",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹",
    oxidationStates: "+1, +3",
    chemicalProperties: "理论上应与铊（同族）相似，是亚洲国家（日本）首次发现并命名的元素。",
    history: "2004 年日本理化学研究所（RIKEN）合成，2016 年 IUPAC 正式命名，以日本（Nihon，日本语日本）命名。",
    applications: "基础核物理研究。",
    funFact: "113 号元素是亚洲国家首次独立发现并获得命名权的元素，日本 RIKEN 团队历经 9 年（2004-2012），用钙-48 轰击铋靶，总共合成了 3 个鉨原子，才获得 IUPAC 认可。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 114,
    symbol: "Fl",
    nameZh: "鈇",
    nameEn: "Flerovium",
    atomicMass: "289",
    category: "post-transition-metal",
    period: 7,
    group: 14,
    groupLabel: "IVA",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²",
    oxidationStates: "+2",
    chemicalProperties: "位于铅的正下方，但相对论效应预测其化学性质与铅差异显著，可能表现出类似惰性气体的化学不活泼性。",
    history: "1998-1999 年俄美联合团队在杜布纳合成，2012 年 IUPAC 命名，以弗乔罗夫核反应实验室（Flerov Laboratory）命名。",
    applications: "基础核物理研究。",
    funFact: "114 号元素附近（Z≈114，N≈184）被理论预测为超重元素的稳定岛核心——受壳层效应保护，该区域的核素半衰期可能比相邻超重核长得多，实验探索正在进行中。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 115,
    symbol: "Mc",
    nameZh: "镆",
    nameEn: "Moscovium",
    atomicMass: "290",
    category: "post-transition-metal",
    period: 7,
    group: 15,
    groupLabel: "VA",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³",
    oxidationStates: "+1, +3",
    chemicalProperties: "理论上应与铋（同族）相似，无实验验证。",
    history: "2003 年俄美联合团队在杜布纳合成，2016 年 IUPAC 以莫斯科（Moscow）命名。",
    applications: "基础核物理研究。",
    funFact: "镆是通过用 ²⁴⁸Cm 靶被 ⁴⁸Ca 离子轰击合成的——这种钙-48 同位素天然丰度仅 0.187%，极为稀少，需要专门浓缩，是合成超重元素的常用轰击弹头。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 116,
    symbol: "Lv",
    nameZh: "鉝",
    nameEn: "Livermorium",
    atomicMass: "293",
    category: "post-transition-metal",
    period: 7,
    group: 16,
    groupLabel: "VIA",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴",
    oxidationStates: "+2",
    chemicalProperties: "理论上应与钋（同族）相似，但相对论效应可能使其化学行为偏离预期。",
    history: "2000 年俄美联合团队合成，2012 年 IUPAC 以美国利弗莫尔国家实验室（Lawrence Livermore National Laboratory）命名。",
    applications: "基础核物理研究。",
    funFact: "美国劳伦斯利弗莫尔国家实验室与俄罗斯联合原子核研究所（JINR）长期合作，共同合成了多个超重元素。这种冷战对手之间的科学合作，是人类共同探索物质边界的典范。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 117,
    symbol: "Ts",
    nameZh: "鿬",
    nameEn: "Tennessine",
    atomicMass: "294",
    category: "halogen",
    period: 7,
    group: 17,
    groupLabel: "VIIA",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵",
    oxidationStates: "-1, +1",
    chemicalProperties: "位于卤素族最底部，相对论效应预测其化学性质与传统卤素差异较大，可能表现出类金属特征。",
    history: "2010 年俄美联合团队合成，2016 年 IUPAC 以田纳西州（Tennessee）命名，因该州有橡树岭国家实验室和范德比尔特大学参与研究。",
    applications: "基础核物理研究。",
    funFact: "鿬是迄今合成的第二重元素（仅次于奥加涅相），也是卤素族中最重的成员。合成鿬需要在橡树岭国家实验室特别制备的锫-249 靶，这一准备过程本身就耗费了多年时间和数百万美元。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

  {
    atomicNumber: 118,
    symbol: "Og",
    nameZh: "鿫",
    nameEn: "Oganesson",
    atomicMass: "294",
    category: "noble-gas",
    period: 7,
    group: 18,
    groupLabel: "0族",
    stateAtRoomTemp: "未知（人工合成，半衰期极短）",
    density: "—",
    meltingPoint: 0,
    boilingPoint: 0,
    electronegativity: null,
    electronConfiguration: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶",
    oxidationStates: "0",
    chemicalProperties: "鿫位于稀有气体族最底部，但理论计算表明由于极强的相对论效应，其 7p 轨道扩展，电子结合能降低，可能实际上具有一定化学反应性，与传统稀有气体截然不同。",
    history: "2002 年俄美联合团队在杜布纳合成，2016 年 IUPAC 以尤里·奥加涅相（Yuri Oganessian，超重元素研究先驱）命名——第二个以在世科学家命名的元素。",
    applications: "基础核物理研究。",
    funFact: "鿫是目前元素周期表中原子序数最大的元素，标志着第七周期的完成。理论预测鿫在常温下可能是固态（相对论效应使其沸点远高于氙），这将彻底颠覆稀有气体在常温下均为气态的认知。",
    educationalLinks: [
      "[拓展] 人工合成元素、元素周期表的完善历史",
    ],
  },

] as ChemicalElement[]);
