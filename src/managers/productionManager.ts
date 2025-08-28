// 智能单位生产管理器
export class ProductionManager {
  // 工作部件效率常量
  private static readonly WORK_EFFICIENCY = {
    ENERGY_PER_TICK: 2,  // 每个WORK部件每tick采集2能量
    SOURCE_CAPACITY: 3000, // 矿点容量
    REGENERATION_TIME: 300 // 矿点刷新时间
  };

  // RCL对应的资源和建筑限制
  private static readonly RCL_LIMITS = {
    1: { extensions: 0, maxCreepCost: 300, maxBodyParts: 50 },
    2: { extensions: 5, maxCreepCost: 550, maxBodyParts: 50 },
    3: { extensions: 10, maxCreepCost: 800, maxBodyParts: 50 },
    4: { extensions: 20, maxCreepCost: 1300, maxBodyParts: 50 },
    5: { extensions: 30, maxCreepCost: 1800, maxBodyParts: 50 },
    6: { extensions: 40, maxCreepCost: 2300, maxBodyParts: 50 },
    7: { extensions: 50, maxCreepCost: 2800, maxBodyParts: 50 },
    8: { extensions: 60, maxCreepCost: 3300, maxBodyParts: 50 }
  };

  // 主入口：更新房间生产计划
  public static updateProductionPlan(room: Room): void {
    console.log(`[生产管理] 开始更新房间 ${room.name} 的生产计划`);

    const rcl = room.controller?.level || 1;
    const plan = this.calculateOptimalProductionPlan(room, rcl);

    // 更新房间内存中的生产目标
    this.updateRoomMemoryTargets(room, plan);

    console.log(`[生产管理] 房间 ${room.name} 生产计划:
      矿工: ${plan.staticHarvesters}
      搬运工: ${plan.carriers}
      升级者: ${plan.upgraders}
      建筑者: ${plan.builders}`);
  }

  // 计算最优生产计划
  private static calculateOptimalProductionPlan(room: Room, rcl: number): ProductionPlan {
    const sources = room.find(FIND_SOURCES);
    const limits = this.RCL_LIMITS[rcl as keyof typeof this.RCL_LIMITS] || this.RCL_LIMITS[1];

    // 计算最优矿工配置
    const optimalHarvesters = this.calculateOptimalHarvesters(sources, limits, rcl);

    // 计算所需搬运工数量
    const requiredCarriers = this.calculateRequiredCarriers(room, optimalHarvesters, rcl);

    // 计算升级者数量
    const optimalUpgraders = this.calculateOptimalUpgraders(room, rcl, limits);

    // 计算建筑者数量
    const optimalBuilders = this.calculateOptimalBuilders(room, rcl);

    return {
      staticHarvesters: optimalHarvesters,
      carriers: requiredCarriers,
      upgraders: optimalUpgraders,
      builders: optimalBuilders
    };
  }

  // 计算最优矿工数量和配置
  private static calculateOptimalHarvesters(sources: Source[], limits: any, rcl: number): number {
    const sourceCount = sources.length;

    // 计算每个矿工需要的WORK部件数
    const targetWorkParts = Math.min(
      Math.floor(this.WORK_EFFICIENCY.SOURCE_CAPACITY /
                (this.WORK_EFFICIENCY.REGENERATION_TIME * this.WORK_EFFICIENCY.ENERGY_PER_TICK)),
      6 // 最多6个WORK部件就能完全采集一个矿点
    );

    console.log(`[生产管理] RCL${rcl}: 计算每个矿工需要${targetWorkParts}个WORK部件`);

    // 检查能量是否足够支持这样的矿工
    const workerCost = targetWorkParts * 150; // WORK + MOVE + CARRY 的基本成本
    if (workerCost <= limits.maxCreepCost) {
      console.log(`[生产管理] 能量充足，每个矿点配置1个${targetWorkParts}WORK矿工`);
      return sourceCount; // 每个矿点一个高效矿工
    } else {
      // 能量不足时，使用更多低级矿工
      const affordableWorkParts = Math.floor(limits.maxCreepCost / 150);
      const workersPerSource = Math.ceil(targetWorkParts / affordableWorkParts);
      console.log(`[生产管理] 能量不足，每个矿点需要${workersPerSource}个${affordableWorkParts}WORK矿工`);
      return sourceCount * workersPerSource;
    }
  }

  // 计算所需搬运工数量（优化版）
  private static calculateRequiredCarriers(room: Room, _harvesterCount: number, rcl: number): number {
    const sources = room.find(FIND_SOURCES);

    // 第一部分：矿点运输需求
    let miningCarriers = sources.length; // 每个矿点1个专职搬运工

    // 第二部分：静态工人配送需求
    const staticWorkers = this.countStaticWorkers(room);
    const deliveryCarriers = Math.max(1, Math.ceil(staticWorkers / 4)); // 每4个静态工人1个配送工

    // 第三部分：基础建设需求
    const baseCarriers = 1; // 至少1个处理spawn/extension补给等基础任务

    let totalCarriers = miningCarriers + deliveryCarriers + baseCarriers;

    // RCL调整：低级房间需要更多，高级房间效率更高
    if (rcl <= 2) {
      totalCarriers = Math.ceil(totalCarriers * 1.2); // 低级房间+20%
    } else if (rcl >= 6) {
      totalCarriers = Math.max(3, Math.ceil(totalCarriers * 0.8)); // 高级房间-20%，但至少3个
    }

    const finalCount = Math.min(totalCarriers, 5); // 硬上限降到5个
    console.log(`[生产管理] 搬运工需求计算: 矿点${miningCarriers}+配送${deliveryCarriers}+基础${baseCarriers}=总计${finalCount}`);

    return finalCount;
  }

  // 统计静态工人数量（需要配送的工种）
  private static countStaticWorkers(room: Room): number {
    const staticCreeps = room.find(FIND_MY_CREEPS, {
      filter: (creep) => creep.memory.role === 'upgrader' || creep.memory.role === 'staticHarvester'
    });

    // 加上计划中的建筑者（如果有建筑工地）
    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
    const plannedBuilders = Math.min(constructionSites.length > 0 ? 2 : 0, 2);

    return staticCreeps.length + plannedBuilders;
  }

  // 计算最优升级者数量
  private static calculateOptimalUpgraders(room: Room, rcl: number, _limits: any): number {
    // 首先获取可用位置数量作为硬性上限
    const { StaticUpgrader } = require('../roles/upgrader');
    const maxPositions = StaticUpgrader.getAvailableUpgraderPositionCount(room);

    if (maxPositions === 0) {
      console.log(`[生产管理] 房间 ${room.name} 没有找到可用的升级者位置，不生产升级者`);
      return 0;
    }

    // 根据RCL调整升级者数量
    const baseUpgraders = Math.max(1, Math.floor(rcl / 2));

    // 检查控制器距离
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const controller = room.controller;

    let optimalCount = baseUpgraders;

    if (spawn && controller) {
      const distance = spawn.pos.getRangeTo(controller);
      if (distance > 20) {
        optimalCount = Math.max(baseUpgraders - 1, 1); // 距离远减少升级者
      }
    }

    // 高等级房间减少升级者，专注其他任务
    if (rcl >= 6) {
      optimalCount = Math.max(1, Math.floor(baseUpgraders / 2));
    }

    // 以可用位置数量为上限
    const finalCount = Math.min(optimalCount, maxPositions);

    console.log(`[生产管理] 房间 ${room.name} 升级者计算: 基础${baseUpgraders}个, 优化后${optimalCount}个, 可用位置${maxPositions}个, 最终${finalCount}个`);

    return finalCount;
  }

  // 计算最优建筑者数量
  private static calculateOptimalBuilders(room: Room, rcl: number): number {
    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);

    if (constructionSites.length === 0) {
      return 0; // 没有建筑工地就不需要建筑者
    }

    // 根据建筑工地数量和RCL决定建筑者数量
    let builders = Math.min(constructionSites.length, 2); // 最多2个建筑者

    if (rcl <= 2) {
      builders = 1; // 低等级只要1个建筑者
    }

    return builders;
  }

  // 更新房间内存中的生产目标
  private static updateRoomMemoryTargets(room: Room, plan: ProductionPlan): void {
    const roomMemory = Memory.rooms[room.name];
    if (!roomMemory) return;

    // 平滑过渡：每次最多调整1个单位，避免大幅波动
    roomMemory.staticHarvesters = this.smoothTransition(roomMemory.staticHarvesters, plan.staticHarvesters);
    roomMemory.carriers = this.smoothTransition(roomMemory.carriers, plan.carriers);
    roomMemory.upgraders = this.smoothTransition(roomMemory.upgraders, plan.upgraders);
    roomMemory.builders = this.smoothTransition(roomMemory.builders, plan.builders);

    console.log(`[生产管理] 更新生产目标完成`);
  }

  // 平滑过渡函数，避免生产计划剧烈变化
  private static smoothTransition(current: number, target: number): number {
    const maxChange = 1; // 每次最多变化1个单位

    if (Math.abs(current - target) <= maxChange) {
      return target;
    }

    return current < target ? current + maxChange : current - maxChange;
  }

  // 获取推荐的单位身体部件配置（使用RCL上限）
  public static getRecommendedBodyParts(role: string, rcl: number): BodyPartConstant[] {
    const limits = this.RCL_LIMITS[rcl as keyof typeof this.RCL_LIMITS] || this.RCL_LIMITS[1];

    switch (role) {
      case 'staticHarvester':
        return this.getHarvesterBody(limits);
      case 'carrier':
        return this.getCarrierBody(limits);
      case 'upgrader':
        return this.getUpgraderBody(limits);
      case 'builder':
        return this.getBuilderBody(limits);
      default:
        return [WORK, CARRY, MOVE]; // 默认配置
    }
  }

  // 获取推荐的单位身体部件配置（使用实际可用能量）
  public static getRecommendedBodyPartsWithEnergy(role: string, availableEnergy: number): BodyPartConstant[] {
    const limits = { maxCreepCost: availableEnergy, maxBodyParts: 50 };

    switch (role) {
      case 'staticHarvester':
        return this.getHarvesterBody(limits);
      case 'carrier':
        return this.getCarrierBody(limits);
      case 'upgrader':
        return this.getUpgraderBody(limits);
      case 'builder':
        return this.getBuilderBody(limits);
      default:
        return [WORK, CARRY, MOVE]; // 默认配置
    }
  }

  // 矿工身体部件配置
  private static getHarvesterBody(limits: any): BodyPartConstant[] {
    // 目标：6个WORK部件 + 最少的MOVE和CARRY
    const maxWorkParts = Math.min(6, Math.floor(limits.maxCreepCost / 100));
    const workParts = Math.max(1, maxWorkParts);

    const body: BodyPartConstant[] = [];

    // 添加WORK部件
    for (let i = 0; i < workParts; i++) {
      body.push(WORK);
    }

    // 静态矿工不需要MOVE和CARRY（会被搬运工拉到位置，能量直接掉落地面）
    // 不添加CARRY部件，让能量掉落地面由搬运工收集

    return body;
  }

  // 搬运工身体部件配置（2 CARRY : 1 MOVE 比例）
  private static getCarrierBody(limits: any): BodyPartConstant[] {
    const maxCost = limits.maxCreepCost;
    const unitCost = 150; // 2 CARRY (100) + 1 MOVE (50) = 150
    const maxUnits = Math.floor(maxCost / unitCost);
    const units = Math.max(1, Math.min(maxUnits, 16)); // 最多16组，避免超过50部件限制

    const body: BodyPartConstant[] = [];

    // 按比例添加部件：2 CARRY + 1 MOVE
    for (let i = 0; i < units; i++) {
      body.push(CARRY);
      body.push(CARRY);
      body.push(MOVE);
    }

    console.log(`[生产管理] 搬运工身体配置: ${units}组(2CARRY+1MOVE), 总成本: ${units * unitCost}, 容量: ${units * 100}`);
    return body;
  }

  // 静态升级者身体部件配置
  private static getUpgraderBody(limits: any): BodyPartConstant[] {
    // 目标：CARRY:WORK 2:1比例，无MOVE部件（静态升级者由搬运工拉到控制器旁）
    const maxCost = limits.maxCreepCost;
    const unitCost = 200; // 1个WORK(100) + 2个CARRY(100) = 200
    const maxUnits = Math.floor(maxCost / unitCost);
    const units = Math.max(1, Math.min(maxUnits, 8)); // 最多8组，避免过度复杂

    const body: BodyPartConstant[] = [];

    // 按照CARRY:WORK 2:1的比例添加部件
    for (let i = 0; i < units; i++) {
      body.push(WORK);
      body.push(CARRY);
      body.push(CARRY);
    }

    console.log(`[生产管理] 静态升级者配置: ${units}组WORK+2CARRY，总成本: ${units * unitCost}`);
    return body;
  }

  // 建筑者身体部件配置
  private static getBuilderBody(limits: any): BodyPartConstant[] {
    // 目标：平衡WORK、CARRY、MOVE，适合建造和修理
    return this.getUpgraderBody(limits); // 与升级者相同配置
  }
}

// 生产计划接口
interface ProductionPlan {
  staticHarvesters: number;
  carriers: number;
  upgraders: number;
  builders: number;
}

// 兼容性导出函数
export function updateProductionPlan(room: Room): void {
  ProductionManager.updateProductionPlan(room);
}

export function getRecommendedBodyParts(role: string, rcl: number): BodyPartConstant[] {
  return ProductionManager.getRecommendedBodyParts(role, rcl);
}

export function getRecommendedBodyPartsWithEnergy(role: string, availableEnergy: number): BodyPartConstant[] {
  return ProductionManager.getRecommendedBodyPartsWithEnergy(role, availableEnergy);
}
