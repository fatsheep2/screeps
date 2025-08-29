// 任务系统调试工具
import { TaskSystem } from '../managers/taskSystem';

export class TaskDebug {
  // 显示所有房间的任务状态
  public static showAllTasks(): void {
    console.log('=== 任务系统调试报告 ===');
    
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room.controller?.my) continue;
      
      console.log(`\n房间 ${roomName}:`);
      TaskSystem.debugRoomTasks(room);
      
      // 显示搬运工状态
      const carriers = room.find(FIND_MY_CREEPS, {
        filter: c => (c.memory as any).role === 'carrier'
      });
      
      console.log(`  搬运工状态:`);
      for (const carrier of carriers) {
        const taskId = (carrier.memory as any).currentTaskId;
        const energy = carrier.store.getUsedCapacity(RESOURCE_ENERGY);
        const capacity = carrier.store.getCapacity(RESOURCE_ENERGY);
        console.log(`    ${carrier.name}: 任务=${taskId || '无'}, 能量=${energy}/${capacity}`);
      }
    }
    
    console.log('=== 调试报告结束 ===\n');
  }
  
  // 检查搬运工卡住状态
  public static diagnoseCrackCarriers(roomName?: string): void {
    console.log('=== 搬运工卡住诊断 ===');
    
    const rooms = roomName ? [roomName] : Object.keys(Game.rooms);
    
    for (const rName of rooms) {
      const room = Game.rooms[rName];
      if (!room?.controller?.my) continue;
      
      console.log(`\n房间 ${rName}:`);
      
      const carriers = room.find(FIND_MY_CREEPS, {
        filter: c => (c.memory as any).role === 'carrier'
      });
      
      for (const carrier of carriers) {
        const taskId = (carrier.memory as any).currentTaskId;
        const energy = carrier.store.getUsedCapacity(RESOURCE_ENERGY);
        
        if (taskId) {
          const roomMemory = Memory.rooms[rName];
          const task = roomMemory?.tasks?.[taskId];
          
          if (!task) {
            console.log(`  🚨 ${carrier.name}: 任务ID ${taskId} 不存在，应清理!`);
          } else {
            console.log(`  ✅ ${carrier.name}: 任务 ${task.type}，能量 ${energy}`);
          }
        } else {
          console.log(`  💤 ${carrier.name}: 无任务，能量 ${energy}`);
        }
      }
    }
    
    console.log('=== 诊断完成 ===\n');
  }
  
  // 强制清理所有任务（紧急修复用）
  public static clearAllTasks(roomName: string): void {
    const roomMemory = Memory.rooms[roomName];
    if (roomMemory && roomMemory.tasks) {
      const taskCount = Object.keys(roomMemory.tasks).length;
      (roomMemory as any).tasks = {};
      console.log(`[调试] 已清理房间 ${roomName} 的 ${taskCount} 个任务`);
    }
    
    // 清理所有creep的任务ID
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName];
      if (creep.room.name === roomName && (creep.memory as any).currentTaskId) {
        delete (creep.memory as any).currentTaskId;
        console.log(`[调试] 已清理 ${creep.name} 的任务ID`);
      }
    }
  }
  
  // 检查任务完成逻辑
  public static testTaskCompletion(creepName: string): void {
    const creep = Game.creeps[creepName];
    if (!creep) {
      console.log(`[调试] 找不到creep: ${creepName}`);
      return;
    }
    
    const taskId = (creep.memory as any).currentTaskId;
    if (!taskId) {
      console.log(`[调试] ${creepName} 没有分配任务`);
      return;
    }
    
    console.log(`[调试] ${creepName} 当前任务ID: ${taskId}`);
    console.log(`[调试] 尝试完成任务...`);
    
    TaskSystem.completeTask(creep);
    
    console.log(`[调试] 任务完成后，creep任务ID: ${(creep.memory as any).currentTaskId || '无'}`);
  }
  
  // 检查extension状态
  public static checkExtensions(roomName: string): void {
    const room = Game.rooms[roomName];
    if (!room) return;
    
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    }) as StructureExtension[];
    
    console.log(`房间 ${roomName} Extension状态:`);
    for (const extension of extensions) {
      const freeCapacity = extension.store.getFreeCapacity(RESOURCE_ENERGY);
      const usedCapacity = extension.store.getUsedCapacity(RESOURCE_ENERGY);
      console.log(`  ${extension.id}: ${usedCapacity}/${usedCapacity + freeCapacity} (需要: ${freeCapacity})`);
    }
  }
}