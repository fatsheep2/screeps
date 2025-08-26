import { getRoomCombatSquads } from './combatManager';
import { ATTACK_ASSESSMENT_CONFIG } from '../config/combatConfig';

// 攻击任务状态
export type AttackTaskStatus = 'planning' | 'moving' | 'engaging' | 'retreating' | 'completed' | 'failed';

// 攻击任务结构
export interface AttackTask {
  id: string;
  targetRoom: string;
  sourceRoom: string;
  squads: string[]; // 参与攻击的战斗小组ID
  status: AttackTaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  targetType: 'room' | 'structure' | 'creep';
  targetId?: string; // 特定目标ID
  estimatedEnergy: number; // 预估所需能量
  currentEnergy: number; // 当前可用能量
}

// 房间攻击评估结果
export interface RoomAttackAssessment {
  roomName: string;
  threatLevel: 'low' | 'medium' | 'high' | 'extreme';
  estimatedDefenders: number;
  estimatedStructures: number;
  recommendedSquads: number; // 建议的战斗小组数量
  energyCost: number;
  successProbability: number;
}

// 创建攻击任务
export function createAttackTask(
  sourceRoom: Room,
  targetRoom: string,
  priority: AttackTask['priority'] = 'medium',
  targetType: AttackTask['targetType'] = 'room'
): string | null {
  // 检查是否有可用的战斗小组
  const availableSquads = getRoomCombatSquads(sourceRoom);
  if (availableSquads.length === 0) {
    console.log(`房间 ${sourceRoom.name} 没有可用的战斗小组`);
    return null;
  }

  // 评估目标房间
  const assessment = assessRoomForAttack(targetRoom);
  if (!assessment) {
    console.log(`无法评估房间 ${targetRoom} 的攻击难度`);
    return null;
  }

  // 检查是否有足够的战斗力量
  if (availableSquads.length < assessment.recommendedSquads) {
    console.log(`战斗力量不足，需要 ${assessment.recommendedSquads} 个小组，当前只有 ${availableSquads.length} 个`);

    // 如果优先级为 critical，允许使用现有力量进行攻击
    if (priority === 'critical') {
      console.log(`优先级为 critical，使用现有力量进行攻击`);
    } else {
      console.log(`建议等待更多战斗单位生产完成，或提高攻击优先级`);
      return null;
    }
  }

  // 使用可用的战斗小组数量（不超过建议数量）
  const squadsToUse = Math.min(availableSquads.length, assessment.recommendedSquads);

  // 创建攻击任务
  const taskId = `attack_${Game.time}_${Math.floor(Math.random() * 1000)}`;
  const task: AttackTask = {
    id: taskId,
    targetRoom,
    sourceRoom: sourceRoom.name,
    squads: availableSquads.slice(0, squadsToUse).map(squad => squad.id),
    status: 'planning',
    priority,
    createdAt: Game.time,
    targetType,
    estimatedEnergy: assessment.energyCost,
    currentEnergy: sourceRoom.energyAvailable
  };

  // 存储攻击任务
  if (!Memory.attackTasks) Memory.attackTasks = {};
  Memory.attackTasks![taskId] = task;

  // 为战斗小组分配攻击任务
  for (const squadId of task.squads) {
    if (Memory.combatSquads && Memory.combatSquads[squadId]) {
      Memory.combatSquads[squadId].attackTaskId = taskId;
      Memory.combatSquads[squadId].status = 'engaged';
    }
  }

  console.log(`创建攻击任务 ${taskId}: 攻击房间 ${targetRoom}，优先级 ${priority}，使用 ${squadsToUse} 个战斗小组`);
  return taskId;
}

// 评估房间的攻击难度
export function assessRoomForAttack(roomName: string): RoomAttackAssessment | null {
  // 注意：这里只能评估已知信息的房间
  // 对于未知房间，需要先进行侦察

  const room = Game.rooms[roomName];
  if (!room) {
    // 房间未知，返回基础评估
    return {
      roomName,
      threatLevel: 'medium',
      estimatedDefenders: 3,
      estimatedStructures: 10,
      recommendedSquads: 2,
      energyCost: 2000,
      successProbability: 0.6
    };
  }

  // 分析房间防御力量
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  const structures = room.find(FIND_HOSTILE_STRUCTURES);

  // 使用配置的阈值计算威胁等级
  const config = ATTACK_ASSESSMENT_CONFIG;
  let threatLevel: RoomAttackAssessment['threatLevel'] = 'low';

  if (hostiles.length >= config.THREAT_THRESHOLDS.EXTREME.hostiles ||
      structures.length >= config.THREAT_THRESHOLDS.EXTREME.structures) {
    threatLevel = 'extreme';
  } else if (hostiles.length >= config.THREAT_THRESHOLDS.HIGH.hostiles ||
             structures.length >= config.THREAT_THRESHOLDS.HIGH.structures) {
    threatLevel = 'high';
  } else if (hostiles.length >= config.THREAT_THRESHOLDS.MEDIUM.hostiles ||
             structures.length >= config.THREAT_THRESHOLDS.MEDIUM.structures) {
    threatLevel = 'medium';
  }

  // 使用配置的参数计算建议的战斗小组数量
  const totalThreat = (hostiles.length * config.SQUAD_CALCULATION.HOSTILE_WEIGHT) +
                      (structures.length * config.SQUAD_CALCULATION.STRUCTURE_WEIGHT);
  const recommendedSquads = Math.ceil(totalThreat / config.SQUAD_CALCULATION.DIVISOR);

  // 计算预估能量消耗
  const energyCost = (hostiles.length * config.ENERGY_ESTIMATION.HOSTILE_COST) +
                     (structures.length * config.ENERGY_ESTIMATION.STRUCTURE_COST);

  // 使用配置的成功概率
  const successProbability = config.SUCCESS_PROBABILITY[threatLevel.toUpperCase() as keyof typeof config.SUCCESS_PROBABILITY] || 0.5;

  return {
    roomName,
    threatLevel,
    estimatedDefenders: hostiles.length,
    estimatedStructures: structures.length,
    recommendedSquads: Math.min(recommendedSquads, config.SQUAD_CALCULATION.MAX_SQUADS),
    energyCost,
    successProbability
  };
}

// 执行攻击任务
export function executeAttackTask(taskId: string): void {
  const task = Memory.attackTasks?.[taskId];
  if (!task) return;

  // 更新任务状态
  if (task.status === 'planning') {
    task.status = 'moving';
    task.startedAt = Game.time;
    console.log(`攻击任务 ${taskId} 开始执行`);
  }

  // 协调战斗小组移动到目标房间
  coordinateSquadsMovement(task);
}

// 协调战斗小组移动
function coordinateSquadsMovement(task: AttackTask): void {
  if (!Memory.combatSquads) return;

  for (const squadId of task.squads) {
    const squad = Memory.combatSquads[squadId];
    if (!squad) continue;

    // 为每个小组成员设置移动目标
    for (const [_role, memberName] of Object.entries(squad.members)) {
      const member = Game.creeps[memberName];
      if (member && member.room.name !== task.targetRoom) {
        // 设置移动目标
        member.memory.attackTarget = task.targetRoom;
        member.memory.attackTaskId = task.id;
        member.say('🚀 出击');
      }
    }
  }
}

// 更新攻击任务状态
export function updateAttackTasks(): void {
  if (!Memory.attackTasks) return;

  // console.log(`[攻击管理] 开始更新攻击任务，总任务数: ${Object.keys(Memory.attackTasks).length}`);

  for (const taskId in Memory.attackTasks) {
    const task = Memory.attackTasks![taskId];
    // console.log(`[攻击管理] 更新任务 ${taskId}: 状态=${task.status}, 目标房间=${task.targetRoom}, 编组数=${task.squads.length}`);

    switch (task.status) {
      case 'planning':
        // console.log(`[攻击管理] 任务 ${taskId} 处于规划状态，开始协调编组移动`);
        // 规划阶段：协调编组移动到目标房间
        coordinateSquadsMovement(task);
        // 自动转换为移动状态
        task.status = 'moving';
        // console.log(`[攻击管理] 任务 ${taskId} 状态更新为: moving`);
        break;

      case 'moving':
        // console.log(`[攻击管理] 任务 ${taskId} 处于移动状态，检查进度`);
        // 移动阶段：检查编组是否到达目标房间
        checkTaskProgress(task);
        break;

      case 'engaging':
        // console.log(`[攻击管理] 任务 ${taskId} 处于交战状态，执行攻击`);
        // 交战阶段：执行攻击逻辑
        executeAttackTask(taskId);
        break;

              case 'retreating':
          // console.log(`[攻击管理] 任务 ${taskId} 处于撤退状态`);
          // 撤退阶段：编组返回源房间
          break;

        case 'completed':
        case 'failed':
          // console.log(`[攻击管理] 任务 ${taskId} 已完成/失败，清理任务`);
          // 任务完成或失败，清理
          break;
    }
  }
}

// 检查任务进度
function checkTaskProgress(task: AttackTask): void {
  if (!Memory.combatSquads) return;

  let allSquadsInTargetRoom = true;
  let anySquadEngaging = false;
  let anySquadNearTargetRoom = false;

  for (const squadId of task.squads) {
    const squad = Memory.combatSquads[squadId];
    if (!squad) continue;

    // 检查小组成员是否都在目标房间
    const membersInTargetRoom = Object.values(squad.members).every(memberName => {
      if (!memberName) return false;
      const member = Game.creeps[memberName];
      return member && member.room.name === task.targetRoom;
    });

    if (!membersInTargetRoom) {
      allSquadsInTargetRoom = false;

      // 检查是否有成员接近目标房间（在相邻房间）
      const membersNearTargetRoom = Object.values(squad.members).some(memberName => {
        if (!memberName) return false;
        const member = Game.creeps[memberName];
        if (!member) return false;

        // 检查是否在相邻房间
        const adjacentRooms = getAdjacentRooms(member.room.name);
        return adjacentRooms.includes(task.targetRoom);
      });

      if (membersNearTargetRoom) {
        anySquadNearTargetRoom = true;
      }
    } else {
      // 检查是否有小组成员正在战斗
      const hasEngagement = Object.values(squad.members).some(memberName => {
        if (!memberName) return false;
        const member = Game.creeps[memberName];
        return member && member.memory.working;
      });
      if (hasEngagement) anySquadEngaging = true;
    }
  }

  // 更新任务状态
  if (allSquadsInTargetRoom && task.status === 'moving') {
    task.status = 'engaging';
    console.log(`攻击任务 ${task.id} 进入战斗阶段，所有编组已到达目标房间`);
  } else if (anySquadNearTargetRoom && task.status === 'moving') {
    // 如果有编组接近目标房间，继续移动状态
    console.log(`攻击任务 ${task.id} 编组接近目标房间，继续移动`);
  } else if (task.status === 'moving') {
    console.log(`攻击任务 ${task.id} 编组正在向目标房间移动中...`);
  }

  if (anySquadEngaging && task.status === 'engaging') {
    // 检查是否应该撤退
    if (shouldRetreat(task)) {
      task.status = 'retreating';
      console.log(`攻击任务 ${task.id} 开始撤退`);
    }
  }
}

// 获取相邻房间列表
function getAdjacentRooms(roomName: string): string[] {
  const adjacentRooms: string[] = [];

  // 解析房间名称格式（如 W2N5）
  const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
  if (!match) return adjacentRooms;

  const [, direction, x, ns, y] = match;
  const xNum = parseInt(x);
  const yNum = parseInt(y);

  // 计算相邻房间
  if (direction === 'W') {
    adjacentRooms.push(`E${xNum - 1}${ns}${yNum}`);
  } else {
    adjacentRooms.push(`W${xNum + 1}${ns}${yNum}`);
  }

  if (ns === 'N') {
    adjacentRooms.push(`${direction}${xNum}S${yNum - 1}`);
  } else {
    adjacentRooms.push(`${direction}${xNum}N${yNum + 1}`);
  }

  return adjacentRooms;
}

// 判断是否应该撤退
function shouldRetreat(task: AttackTask): boolean {
  if (!Memory.combatSquads) return false;

  let totalHealth = 0;
  let totalMaxHealth = 0;

  // 计算所有小组成员的健康状态
  for (const squadId of task.squads) {
    const squad = Memory.combatSquads[squadId];
    if (!squad) continue;

    for (const memberName of Object.values(squad.members)) {
      const member = Game.creeps[memberName];
      if (member) {
        totalHealth += member.hits;
        totalMaxHealth += member.hitsMax;
      }
    }
  }

  // 如果总体健康度低于50%，考虑撤退
  if (totalMaxHealth > 0 && (totalHealth / totalMaxHealth) < 0.5) {
    return true;
  }

  return false;
}



// 获取房间的攻击任务
export function getRoomAttackTasks(roomName: string): AttackTask[] {
  if (!Memory.attackTasks) return [];

  return Object.values(Memory.attackTasks).filter(task =>
    task.sourceRoom === roomName || task.targetRoom === roomName
  );
}

// 手动触发攻击（供玩家使用）
export function manualAttack(sourceRoom: Room, targetRoom: string): string | null {
  console.log(`手动触发攻击: ${sourceRoom.name} → ${targetRoom}`);
  return createAttackTask(sourceRoom, targetRoom, 'high');
}
