// 任务系统类型定义 - 简化版，消除过度设计
//
// Linus规则：好品味就是消除特殊情况
// 这里只导出核心接口，不重复定义

// 从 taskSystem.ts 导入统一的任务类型
export { TaskType, TaskPriority, Task, TaskStatus } from '../managers/taskSystem';
