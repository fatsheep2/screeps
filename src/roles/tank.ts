// 坦克角色逻辑
export class RoleTank {
  static run(creep: Creep): void {
    // 检查是否有攻击任务
    if (creep.memory.attackTaskId && creep.memory.attackTarget) {
      this.handleAttackTask(creep);
      return;
    }

    // 检查生命值，如果太低则撤退
    if (creep.hits < creep.hitsMax * 0.3) {
      this.retreat(creep);
      return;
    }

    // 寻找敌人
    const target = this.findTarget(creep);

    if (target) {
      // 接近敌人，吸引火力
      this.engage(creep, target);
    } else {
      // 没有敌人时，保护重要建筑
      this.protect(creep);
    }
  }

    // 处理攻击任务
  private static handleAttackTask(creep: Creep): void {
    const targetRoom = creep.memory.attackTarget;
    if (!targetRoom) return;

    console.log(`[坦克${creep.name}] 处理攻击任务，目标房间: ${targetRoom}`);

    // 如果不在目标房间，移动到目标房间
    if (creep.room.name !== targetRoom) {
      console.log(`[坦克${creep.name}] 当前在房间 ${creep.room.name}，需要移动到 ${targetRoom}`);
      this.moveToTargetRoom(creep, targetRoom);
      return;
    }

    console.log(`[坦克${creep.name}] 已在目标房间 ${targetRoom}，开始编队流程`);

    // 在目标房间中，开始编队流程
    this.startFormationProcess(creep);
  }

    // 开始编队流程
  private static startFormationProcess(creep: Creep): void {
    if (!creep.memory.squadId || !Memory.combatSquads || !Memory.combatSquads[creep.memory.squadId]) {
      console.log(`[坦克${creep.name}] 编组信息缺失，squadId: ${creep.memory.squadId}`);
      return;
    }

    const squad = Memory.combatSquads[creep.memory.squadId];
    console.log(`[坦克${creep.name}] 编组 ${squad.id} 状态: ${(squad as any).status || 'unknown'}`);

    // 检查编组是否已经列队完成
    if ((squad as any).formationComplete) {
      console.log(`[坦克${creep.name}] 编组已列队完成，开始向敌人移动`);
      // 列队完成，开始向敌人移动
      this.leadSquadToEnemy(creep, squad);
      return;
    }

    // 检查是否在房间边界，如果是则先离开边界
    if (this.isAtRoomBorder(creep)) {
      console.log(`[坦克${creep.name}] 在房间边界，先离开边界`);
      this.moveAwayFromBorder(creep);
      return;
    }

    // 检查所有成员是否都在目标房间
    const allMembersInRoom = this.checkAllMembersInRoom(squad, creep.room.name);
    console.log(`[坦克${creep.name}] 检查成员房间状态: ${allMembersInRoom ? '全部到达' : '还有成员未到达'}`);

    if (!allMembersInRoom) {
      // 还有成员未到达，等待并显示缺失成员
      creep.say('⏳ 等待队友');
      this.showMissingMembers(squad, creep.room.name);

      // 如果坦克在边界附近，移动到更安全的位置等待
      if (this.isNearBorder(creep)) {
        this.moveToSafeWaitingPosition(creep);
      }
      return;
    }

    console.log(`[坦克${creep.name}] 所有成员已到达，开始列队`);
    // 所有成员都已到达，开始列队
    this.organizeFormation(creep, squad);
  }



    // 检查所有成员是否都在目标房间
  private static checkAllMembersInRoom(squad: any, roomName: string): boolean {
    const members = Object.values((squad.members as any));
    console.log(`[编组检查] 编组 ${squad.id} 成员: ${JSON.stringify(members)}`);

    const result = members.every(memberName => {
      const member = Game.creeps[memberName as string];
      const inRoom = member && member.room.name === roomName;
      console.log(`[编组检查] 成员 ${memberName}: ${inRoom ? '在房间' : '不在房间'} (${member?.room.name || 'null'})`);
      return inRoom;
    });

    console.log(`[编组检查] 编组 ${squad.id} 房间检查结果: ${result}`);
    return result;
  }

    // 显示缺失的成员
  private static showMissingMembers(squad: any, roomName: string): void {
    const missingMembers: string[] = [];

    Object.entries((squad.members as any)).forEach(([role, memberName]) => {
      if (memberName) {
        const member = Game.creeps[memberName as string];
        if (!member || member.room.name !== roomName) {
          missingMembers.push(`${role}: ${memberName} (${member?.room.name || '死亡'})`);
        }
      }
    });

    if (missingMembers.length > 0) {
      console.log(`[坦克] 编组 ${squad.id} 还有成员未到达 ${roomName}: ${missingMembers.join(', ')}`);
    }
  }

  // 检查是否在房间边界
  private static isAtRoomBorder(creep: Creep): boolean {
    // 检查是否在房间边缘2格范围内
    const borderDistance = 2;
    return creep.pos.x <= borderDistance ||
           creep.pos.x >= 50 - borderDistance ||
           creep.pos.y <= borderDistance ||
           creep.pos.y >= 50 - borderDistance;
  }

    // 离开房间边界
  private static moveAwayFromBorder(creep: Creep): void {
    // 计算房间中心位置
    const centerX = 25;
    const centerY = 25;

    // 计算从当前位置到中心的方向
    const dx = centerX - creep.pos.x;
    const dy = centerY - creep.pos.y;

    // 选择移动方向（优先选择距离中心更远的方向）
    let moveDirection: DirectionConstant;

    if (Math.abs(dx) > Math.abs(dy)) {
      // X方向距离更远，优先移动X方向
      moveDirection = dx > 0 ? RIGHT : LEFT;
    } else {
      // Y方向距离更远，优先移动Y方向
      moveDirection = dy > 0 ? BOTTOM : TOP;
    }

    // 尝试移动
    const result = creep.move(moveDirection);
    if (result === OK) {
      console.log(`[坦克${creep.name}] 离开边界，移动方向: ${moveDirection}`);
      creep.say('🚶 离开边界');
    } else {
      console.log(`[坦克${creep.name}] 移动失败: ${result}`);
      // 如果移动失败，尝试移动到房间中心
      const centerPos = new RoomPosition(centerX, centerY, creep.room.name);
      creep.moveTo(centerPos, {
        visualizePathStyle: { stroke: '#ffaa00' }
      });
      creep.say('🎯 向中心移动');
    }
  }

  // 检查是否接近边界
  private static isNearBorder(creep: Creep): boolean {
    // 检查是否在房间边缘4格范围内
    const nearBorderDistance = 4;
    return creep.pos.x <= nearBorderDistance ||
           creep.pos.x >= 50 - nearBorderDistance ||
           creep.pos.y <= nearBorderDistance ||
           creep.pos.y >= 50 - nearBorderDistance;
  }

  // 移动到安全的等待位置
  private static moveToSafeWaitingPosition(creep: Creep): void {
    // 计算安全的等待位置（距离边界至少5格）
    const safeDistance = 5;
    let targetX = creep.pos.x;
    let targetY = creep.pos.y;

    // 如果太靠近左边界，向右移动
    if (creep.pos.x <= safeDistance) {
      targetX = safeDistance + 2;
    }
    // 如果太靠近右边界，向左移动
    else if (creep.pos.x >= 50 - safeDistance) {
      targetX = 50 - safeDistance - 2;
    }

    // 如果太靠近上边界，向下移动
    if (creep.pos.y <= safeDistance) {
      targetY = safeDistance + 2;
    }
    // 如果太靠近下边界，向上移动
    else if (creep.pos.y >= 50 - safeDistance) {
      targetY = 50 - safeDistance - 2;
    }

    // 移动到安全位置
    const safePos = new RoomPosition(targetX, targetY, creep.room.name);
    creep.moveTo(safePos, {
      visualizePathStyle: { stroke: '#ffaa00' }
    });
    console.log(`[坦克${creep.name}] 移动到安全等待位置: ${targetX},${targetY}`);
    creep.say('🛡️ 安全位置');
  }

  // 组织编队
  private static organizeFormation(creep: Creep, squad: any): void {
    console.log(`[坦克${creep.name}] 开始组织编队，坦克位置: ${creep.pos.x},${creep.pos.y}`);

    // 以坦克位置为基准，计算其他成员的目标位置
    const tankPos = creep.pos;

    // 检查是否所有成员都在正确位置
    const formationReady = this.checkFormationReady(squad, tankPos);
    console.log(`[坦克${creep.name}] 编队就绪检查: ${formationReady}`);

    if (formationReady) {
      // 列队完成
      (squad as any).formationComplete = true;
      (squad as any).formationCenter = { x: tankPos.x, y: tankPos.y };
      console.log(`[坦克${creep.name}] 编组 ${squad.id} 列队完成！中心位置: ${tankPos.x},${tankPos.y}`);
      creep.say('🎯 列队完成');
    } else {
      // 继续列队
      creep.say('📐 列队中');
    }
  }

  // 检查列队是否就绪
  private static checkFormationReady(squad: any, tankPos: RoomPosition): boolean {
    console.log(`[编队检查] 开始检查编队就绪状态，坦克位置: ${tankPos.x},${tankPos.y}`);

    // 检查战士位置（坦克下方1格）
    const warriorName = (squad.members as any).warrior;
    if (warriorName) {
      const warrior = Game.creeps[warriorName];
      if (warrior) {
        const targetPos = new RoomPosition(tankPos.x, tankPos.y + 1, tankPos.roomName);
        const distance = warrior.pos.getRangeTo(targetPos);
        console.log(`[编队检查] 战士 ${warriorName} 距离目标位置: ${distance}，目标: ${targetPos.x},${targetPos.y}`);
        if (distance > 1) return false;
      }
    }

    // 检查弓箭手位置（坦克左上方1格）
    const archerName = (squad.members as any).archer;
    if (archerName) {
      const archer = Game.creeps[archerName];
      if (archer) {
        const targetPos = new RoomPosition(tankPos.x - 1, tankPos.y - 1, tankPos.roomName);
        const distance = archer.pos.getRangeTo(targetPos);
        console.log(`[编队检查] 弓箭手 ${archerName} 距离目标位置: ${distance}，目标: ${targetPos.x},${targetPos.y}`);
        if (distance > 1) return false;
      }
    }

    // 检查牧师位置（坦克右上方1格）
    const healerName = (squad.members as any).healer;
    if (healerName) {
      const healer = Game.creeps[healerName];
      if (healer) {
        const targetPos = new RoomPosition(tankPos.x + 1, tankPos.y - 1, tankPos.roomName);
        const distance = healer.pos.getRangeTo(targetPos);
        console.log(`[编队检查] 牧师 ${healerName} 距离目标位置: ${distance}，目标: ${targetPos.x},${targetPos.y}`);
        if (distance > 1) return false;
      }
    }

    console.log(`[编队检查] 编队就绪检查完成: true`);
    return true;
  }

  // 带领编组向敌人移动
  private static leadSquadToEnemy(creep: Creep, squad: any): void {
    console.log(`[坦克${creep.name}] 开始带领编组向敌人移动`);

    // 寻找敌人
    const enemies = creep.room.find(FIND_HOSTILE_CREEPS);
    console.log(`[坦克${creep.name}] 房间中发现敌人数量: ${enemies.length}`);

    if (enemies.length === 0) {
      console.log(`[坦克${creep.name}] 没有敌人，开始巡逻`);
      // 没有敌人，在房间中巡逻
      this.patrol(creep);
      return;
    }

    // 找到最近的敌人
    const closestEnemy = creep.pos.findClosestByRange(enemies);
    if (!closestEnemy) return;

    console.log(`[坦克${creep.name}] 最近敌人位置: ${closestEnemy.pos.x},${closestEnemy.pos.y}，距离: ${creep.pos.getRangeTo(closestEnemy)}`);

    // 计算编组移动目标（保持相对位置）
    const targetPos = this.calculateSquadTargetPosition(creep.pos, closestEnemy.pos);
    console.log(`[坦克${creep.name}] 计算移动目标位置: ${targetPos.x},${targetPos.y}`);

    // 移动到目标位置
    creep.moveTo(targetPos, {
      visualizePathStyle: { stroke: '#ffaa00' }
    });
    creep.say('🚀 出击');

    // 通知其他成员跟随
    this.notifySquadMembers(squad, targetPos);
  }

  // 计算编组移动目标位置
  private static calculateSquadTargetPosition(currentPos: RoomPosition, enemyPos: RoomPosition): RoomPosition {
    // 计算到敌人的方向
    const dx = enemyPos.x - currentPos.x;
    const dy = enemyPos.y - currentPos.y;

    // 移动到距离敌人3格的位置
    const distance = 3;
    const targetX = currentPos.x + Math.sign(dx) * Math.min(Math.abs(dx) - distance, 1);
    const targetY = currentPos.y + Math.sign(dy) * Math.min(Math.abs(dy) - distance, 1);

    return new RoomPosition(targetX, targetY, currentPos.roomName);
  }

  // 通知编组成员跟随
  private static notifySquadMembers(squad: any, targetPos: RoomPosition): void {
    // 在编组内存中记录移动目标
    (squad as any).moveTarget = { x: targetPos.x, y: targetPos.y };
    (squad as any).lastMoveTime = Game.time;
  }





      // 移动到目标房间
  private static moveToTargetRoom(creep: Creep, targetRoom: string): void {
    console.log(`[坦克${creep.name}] 开始移动到目标房间 ${targetRoom}`);

    // 如果已经在目标房间，直接返回
    if (creep.room.name === targetRoom) {
      console.log(`[坦克${creep.name}] 已经在目标房间 ${targetRoom}`);
      return;
    }

    // 使用 exit 移动到目标房间
    const exits = creep.room.findExitTo(targetRoom);
    if (exits === ERR_NO_PATH) {
      console.log(`坦克 ${creep.name} 无法找到到房间 ${targetRoom} 的路径`);
      return;
    }

    if (exits === ERR_INVALID_ARGS) {
      console.log(`坦克 ${creep.name} 目标房间 ${targetRoom} 无效`);
      return;
    }

    // 移动到出口
    const exit = creep.pos.findClosestByRange(exits);
    if (exit) {
      const distanceToExit = creep.pos.getRangeTo(exit);
      console.log(`[坦克${creep.name}] 距离出口: ${distanceToExit}`);

      if (distanceToExit === 0) {
        // 已经在出口位置，尝试直接移动进入目标房间
        console.log(`[坦克${creep.name}] 已在出口位置，尝试进入目标房间`);
        const direction = this.getDirectionToTargetRoom(creep.room.name, targetRoom);
        if (direction !== null) {
          const result = creep.move(direction);
          console.log(`[坦克${creep.name}] 移动结果: ${result}`);
          if (result === OK) {
            creep.say('🚪 进入');
            return;
          }
        }
      } else if (distanceToExit <= 1) {
        // 接近出口，移动到出口位置
        console.log(`[坦克${creep.name}] 接近出口，移动到出口位置`);
        creep.moveTo(exit, {
          visualizePathStyle: { stroke: '#ffaa00' }
        });
        creep.say('🚶 移动');
      } else {
        // 距离出口较远，移动到出口
        console.log(`[坦克${creep.name}] 移动到出口位置`);
        creep.moveTo(exit, {
          visualizePathStyle: { stroke: '#ffaa00' }
        });
        creep.say('🚶 移动');
      }
    }
  }



  // 寻找目标
  private static findTarget(creep: Creep): Creep | Structure | null {
    // 优先攻击最近的敌人Creep
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      return creep.pos.findClosestByRange(hostiles);
    }

    // 其次攻击敌对建筑
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES);
    if (hostileStructures.length > 0) {
      return creep.pos.findClosestByRange(hostileStructures);
    }

    return null;
  }

  // 与敌人交战
  private static engage(creep: Creep, target: Creep | Structure): void {
    if (creep.pos.isNearTo(target)) {
      // 在攻击范围内，进行攻击
      const result = creep.attack(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }
      creep.say('🛡️ 坦克');
    } else {
      // 移动到目标附近
      creep.moveTo(target);
    }
  }

  // 保护重要建筑
  private static protect(creep: Creep): void {
    // 寻找需要保护的建筑（spawn, storage, controller等）
    const importantStructures = creep.room.find(FIND_MY_STRUCTURES, {
      filter: (structure) =>
        structure.structureType === STRUCTURE_SPAWN ||
        structure.structureType === STRUCTURE_STORAGE ||
        structure.structureType === STRUCTURE_TERMINAL
    });

    if (importantStructures.length > 0) {
      // 移动到重要建筑附近进行保护
      const protectTarget = creep.pos.findClosestByRange(importantStructures);
      if (protectTarget && !creep.pos.isNearTo(protectTarget)) {
        creep.moveTo(protectTarget);
      }
    } else {
      // 没有重要建筑时，在房间中心巡逻
      this.patrol(creep);
    }
  }

  // 撤退逻辑
  private static retreat(creep: Creep): void {
    // 寻找安全的撤退点（靠近spawn）
    const safeSpots = creep.room.find(FIND_MY_SPAWNS);
    if (safeSpots.length > 0) {
      const safeSpot = creep.pos.findClosestByRange(safeSpots);
      if (safeSpot) {
        creep.moveTo(safeSpot);
        creep.say('🏃 撤退');
      }
    }
  }


  // 计算到目标房间的移动方向
  private static getDirectionToTargetRoom(currentRoom: string, targetRoom: string): DirectionConstant | null {
    console.log(`[方向计算] 计算从 ${currentRoom} 到 ${targetRoom} 的移动方向`);

    // 解析房间名称格式：W2N5 -> W3N5
    const currentMatch = currentRoom.match(/^([WE])(\d+)([NS])(\d+)$/);
    const targetMatch = targetRoom.match(/^([WE])(\d+)([NS])(\d+)$/);

    if (!currentMatch || !targetMatch) {
      console.log(`[方向计算] 房间名称格式解析失败`);
      return null;
    }

    const [, currentW, currentX, currentN, currentY] = currentMatch;
    const [, targetW, targetX, targetN, targetY] = targetMatch;

    console.log(`[方向计算] 当前: W=${currentW}, X=${currentX}, N=${currentN}, Y=${currentY}`);
    console.log(`[方向计算] 目标: W=${targetW}, X=${targetX}, N=${targetN}, Y=${targetY}`);

    // 计算X方向差异
    if (currentW === targetW && currentX !== targetX) {
      const xDiff = parseInt(targetX) - parseInt(currentX);
      console.log(`[方向计算] X方向差异: ${xDiff}`);

      if (currentW === 'W') {
        // 向西的房间，X增加表示向东移动
        const direction = xDiff > 0 ? RIGHT : LEFT;
        console.log(`[方向计算] 向西房间，X${xDiff > 0 ? '增加' : '减少'}，返回方向: ${direction} (${xDiff > 0 ? 'RIGHT' : 'LEFT'})`);
        return direction;
      } else {
        // 向东的房间，X增加表示向西移动
        const direction = xDiff > 0 ? LEFT : RIGHT;
        console.log(`[方向计算] 向东房间，X${xDiff > 0 ? '增加' : '减少'}，返回方向: ${direction} (${xDiff > 0 ? 'LEFT' : 'RIGHT'})`);
        return direction;
      }
    }

    // 计算Y方向差异
    if (currentN === targetN && currentY !== targetY) {
      const yDiff = parseInt(targetY) - parseInt(currentY);
      console.log(`[方向计算] Y方向差异: ${yDiff}`);

      if (currentN === 'N') {
        // 向北的房间，Y增加表示向南移动
        const direction = yDiff > 0 ? BOTTOM : TOP;
        console.log(`[方向计算] 向北房间，Y${yDiff > 0 ? '增加' : '减少'}，返回方向: ${direction} (${yDiff > 0 ? 'BOTTOM' : 'TOP'})`);
        return direction;
      } else {
        // 向南的房间，Y增加表示向北移动
        const direction = yDiff > 0 ? TOP : BOTTOM;
        console.log(`[方向计算] 向南房间，Y${yDiff > 0 ? '增加' : '减少'}，返回方向: ${direction} (${yDiff > 0 ? 'TOP' : 'BOTTOM'})`);
        return direction;
      }
    }

    console.log(`[方向计算] 无法计算方向，房间不在相邻位置`);
    return null;
  }

  // 巡逻逻辑
  private static patrol(creep: Creep): void {
    // 在房间中心区域巡逻
    const centerX = 25;
    const centerY = 25;

    if (!creep.memory.patrolPoint) {
      creep.memory.patrolPoint = {
        x: centerX + (Math.random() - 0.5) * 10,
        y: centerY + (Math.random() - 0.5) * 10
      };
    }

    const patrolPos = new RoomPosition(
      creep.memory.patrolPoint.x,
      creep.memory.patrolPoint.y,
      creep.room.name
    );

    // 到达巡逻点后重新设置
    if (creep.pos.isNearTo(patrolPos)) {
      delete creep.memory.patrolPoint;
    } else {
      creep.moveTo(patrolPos);
    }
  }
}
