// 任务系统类型定义

// 任务类型
export type TaskType = 'assistStaticHarvester' | 'collectEnergy' | 'transferEnergy' | 'buildStructure' | 'upgradeController';

// 任务状态
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'expired';

// 任务优先级
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// 基础任务接口
export interface BaseTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  roomName: string;
  createdAt: number;
  expiresAt: number;
  assignedTo?: string;
  assignedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

// 协助静态矿工任务
export interface AssistStaticHarvesterTask extends BaseTask {
  type: 'assistStaticHarvester';
  harvesterId: string;
  targetPosition: {
    x: number;
    y: number;
  };
}

// 收集能量任务
export interface CollectEnergyTask extends BaseTask {
  type: 'collectEnergy';
  targetId: string;
  targetType: 'dropped' | 'tombstone' | 'ruin' | 'container';
  position: {
    x: number;
    y: number;
  };
  energyAmount: number;
  storageTargetId?: string; // 存储目标ID
  storageTargetType?: 'extension' | 'spawn' | 'storage' | 'container'; // 存储目标类型
}

// 转移能量任务
export interface TransferEnergyTask extends BaseTask {
  type: 'transferEnergy';
  targetId: string;
  targetType: 'extension' | 'spawn' | 'upgrader' | 'container';
  position: {
    x: number;
    y: number;
  };
  requiredAmount: number;
  sourceId?: string; // 能量来源ID
  sourceType?: 'container' | 'storage' | 'dropped'; // 能量来源类型
}

// 建造结构任务
export interface BuildStructureTask extends BaseTask {
  type: 'buildStructure';
  constructionSiteId: string;
  position: {
    x: number;
    y: number;
  };
  structureType: string;
}

// 升级控制器任务
export interface UpgradeControllerTask extends BaseTask {
  type: 'upgradeController';
  controllerId: string;
  position: {
    x: number;
    y: number;
  };
}

// 联合任务类型
export type Task = AssistStaticHarvesterTask | CollectEnergyTask | TransferEnergyTask | BuildStructureTask | UpgradeControllerTask;

// 任务分配结果
export interface TaskAssignmentResult {
  success: boolean;
  task?: Task;
  reason?: string;
}

// 任务执行结果
export interface TaskExecutionResult {
  success: boolean;
  shouldContinue: boolean;
  message?: string;
  nextAction?: string;
}

// 任务过滤器
export interface TaskFilter {
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  roomName?: string;
  assignedTo?: string;
}

// 任务统计
export interface TaskStatistics {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  failed: number;
  expired: number;
}
