# 任务系统修复说明

## 问题概述

原始任务系统存在以下关键问题：

1. **优先级系统不生效** - 搬运工一直忙于补充能量，没有按照优先级执行任务
2. **矿工搬运任务优先级不够高** - 矿工死了也不会去帮助搬运
3. **能量收集机制不合理** - 与container竞争，导致效率低下
4. **任务分配逻辑有问题** - 没有正确处理关键任务的抢占
5. **静态矿工堵塞spawn** - 导致spawn不能再生成creep

## 修复方案

### 1. 重新设计任务优先级系统

```typescript
export enum TaskPriority {
  CRITICAL = 0,    // 关键：矿工搬运 - 不搬运就没能量生产
  URGENT = 1,      // 紧急：spawn没能量、升级者搬运
  HIGH = 2,        // 高：extension能量供应
  NORMAL = 3,      // 正常：常规物流、建筑
  LOW = 4          // 低优先级：优化性任务
}
```

**关键改进：**
- 矿工搬运任务设为最高优先级（CRITICAL）
- spawn能量供应设为紧急优先级（URGENT）
- extension能量供应设为高优先级（HIGH）
- 避免低优先级任务抢占高优先级任务

### 2. 实现任务抢占机制

```typescript
// 关键任务抢占处理
private static handleCriticalTaskPreemption(room: Room, carriers: Creep[], criticalTasks: Task[]): void {
  for (const criticalTask of criticalTasks) {
    const bestCarrier = this.findBestCarrierForTask(carriers, criticalTask);
    if (bestCarrier && bestCarrier.memory.currentTaskId) {
      const currentTask = roomMemory.tasks?.[bestCarrier.memory.currentTaskId];
      if (currentTask && currentTask.priority > TaskPriority.CRITICAL) {
        // 抢占低优先级任务
        currentTask.status = 'pending';
        this.assignTaskToCreep(room, criticalTask, bestCarrier);
      }
    }
  }
}
```

**关键改进：**
- 高优先级任务可以抢占低优先级任务
- 确保矿工搬运任务不会被延迟
- 动态任务重新分配

### 3. 优化能量收集逻辑

```typescript
// 扫描能量收集需求 - 避免与container竞争
private static scanEnergyCollection(room: Room): void {
  const containers = room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_CONTAINER
  });
  
  const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
    filter: r => {
      if (r.resourceType !== RESOURCE_ENERGY || r.amount < 50) return false;
      
      // 检查是否在container附近5格内
      for (const container of containers) {
        if (r.pos.getRangeTo(container.pos) <= 5) {
          return false; // 太靠近container，让container处理
        }
      }
      
      // 检查是否在spawn附近3格内
      const spawns = room.find(FIND_MY_SPAWNS);
      for (const spawn of spawns) {
        if (r.pos.getRangeTo(spawn.pos) <= 3) {
          return false; // 太靠近spawn，让spawn处理
        }
      }
      
      return true; // 远离container和spawn的资源才收集
    }
  });
}
```

**关键改进：**
- 避免收集container附近5格内的能量
- 避免收集spawn附近3格内的能量
- 只收集远离关键设施的大量掉落资源
- 减少与container的竞争

### 4. 防止spawn堵塞

```typescript
// 检查并清理堵塞spawn的creep
export function checkAndClearSpawnBlockage(room: Room): void {
  const spawns = room.find(FIND_MY_SPAWNS);
  
  for (const spawn of spawns) {
    const nearbyStaticMiners = room.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === 'staticHarvester' &&
                   c.pos.getRangeTo(spawn.pos) <= 3
    });

    if (nearbyStaticMiners.length > 0) {
      // 为每个堵塞的矿工创建紧急搬运任务
      for (const miner of nearbyStaticMiners) {
        // 创建最高优先级的搬运任务
        const taskId = `emergency_transport_miner_${miner.id}_${Game.time}`;
        roomMemory.tasks[taskId] = {
          priority: 0, // 最高优先级
          type: 'transport_miner',
          // ... 其他任务属性
        };
      }
    }
  }
}
```

**关键改进：**
- 定期检查spawn周围是否有堵塞的静态矿工
- 自动创建紧急搬运任务
- 确保spawn周围3格内没有静态矿工

### 5. 优化搬运工行为

```typescript
// 空闲行为：寻找能量来源
private static idleBehavior(creep: Creep): void {
  // 如果背包有能量，寻找需要能量的目标
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
    this.findEnergyTarget(creep);
  } else {
    // 背包没能量，寻找能量来源
    this.collectEnergyFromBestSource(creep);
  }
}

// 从最佳来源收集能量
private static collectEnergyFromBestSource(creep: Creep): void {
  // 优先从container收集
  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_CONTAINER &&
                 s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  });

  if (containers.length > 0) {
    const nearestContainer = creep.pos.findClosestByRange(containers);
    if (nearestContainer) {
      creep.withdraw(nearestContainer, RESOURCE_ENERGY);
      return;
    }
  }

  // 如果没有container，从掉落资源收集（但避免与container竞争）
  // ... 实现逻辑
}
```

**关键改进：**
- 优先从container获取能量（稳定来源）
- 避免与container竞争掉落资源
- 智能选择能量来源

## 测试验证

创建了完整的单元测试来验证修复：

```bash
npm test test/unit/taskSystem.test.ts
```

测试覆盖：
- 任务优先级系统
- 任务创建和分配
- 任务抢占机制
- 能量收集逻辑
- 任务过期处理

## 预期效果

修复后的任务系统应该：

1. **正确执行优先级** - 矿工搬运任务优先于其他任务
2. **避免能量竞争** - container和搬运工不再竞争同一资源
3. **防止spawn堵塞** - 静态矿工自动移动到安全位置
4. **提高整体效率** - 减少无效的能量搬运和收集
5. **动态任务分配** - 高优先级任务可以抢占低优先级任务

## 使用说明

1. **自动运行** - 任务系统会在每个tick自动更新
2. **优先级管理** - 系统自动按优先级分配任务
3. **堵塞检测** - 每10个tick检查并处理spawn堵塞
4. **能量管理** - 每10个tick优化container能量吸收

## 监控和调试

可以通过以下方式监控任务系统：

```typescript
// 获取房间任务统计
const stats = TaskSystem.getTaskStats(room);
console.log('任务统计:', stats);

// 获取creep的当前任务
const task = TaskSystem.getCreepTask(creep);
console.log('当前任务:', task);
```

## 注意事项

1. **性能影响** - 新增的检查逻辑会略微增加CPU使用
2. **内存使用** - 任务系统会占用一定的内存空间
3. **兼容性** - 需要确保所有相关模块都已更新
4. **调试模式** - 建议在测试环境中先验证功能
