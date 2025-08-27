# Screeps 测试指南

## 概述

这个项目包含两种类型的测试：
- **单元测试 (Unit Tests)**: 测试独立的代码单元，速度快，适合开发时使用
- **集成测试 (Integration Tests)**: 测试完整的游戏环境，使用真实的Screeps服务器模拟

## 运行测试

### 运行所有测试
```bash
npm test
```

### 只运行单元测试
```bash
npm run test-unit
```

### 只运行集成测试
```bash
npm run test-integration
```

### 运行特定测试
```bash
# 运行包含"combat"的集成测试
npm run test-integration -- -g combat

# 运行包含"memory"的单元测试
npm run test-unit -- -g memory
```

## 测试文件结构

```
test/
├── unit/                    # 单元测试
│   ├── main.test.ts        # 主要功能测试
│   ├── tank.test.ts        # 坦克角色测试
│   └── mock.ts             # 模拟数据
├── integration/             # 集成测试
│   ├── helper.ts           # 集成测试辅助类
│   ├── integration.test.ts # 基础功能测试
│   └── combat.test.ts      # 战斗系统测试
├── setup-mocha.js          # Mocha配置
└── mocha.opts              # Mocha选项
```

## 单元测试

单元测试使用模拟的Screeps环境，速度快，适合测试独立的逻辑。

### 特点
- 使用`mock.ts`中的模拟数据
- 不依赖真实的Screeps服务器
- 执行速度快
- 适合测试算法和业务逻辑

### 示例
```typescript
import {assert} from "chai";
import {createMockCreep} from "./mock";

describe("Creep测试", () => {
  it("应该能创建Creep", () => {
    const creep = createMockCreep("test", "upgrader", "W1N1");
    assert.equal(creep.name, "test");
    assert.equal(creep.memory.role, "upgrader");
  });
});
```

## 集成测试

集成测试使用`screeps-server-mockup`，提供完整的游戏环境模拟。

### 特点
- 使用真实的Screeps服务器代码
- 完整的游戏环境（房间、资源、控制器等）
- 可以测试完整的游戏循环
- 适合测试系统集成和游戏逻辑

### 测试辅助类

`helper.ts`提供了`IntegrationTestHelper`类，包含：

```typescript
class IntegrationTestHelper {
  server: ScreepsServer;    // 服务器实例
  player: Bot;              // 玩家机器人实例

  async beforeEach();        // 测试前设置
  async afterEach();         // 测试后清理
}
```

### 常用API

#### 服务器控制
```typescript
// 等待一个游戏tick
await helper.server.tick();

// 获取当前游戏时间
const time = await helper.server.world.gameTime;

// 停止服务器
await helper.server.stop();
```

#### 世界操作
```typescript
// 添加房间对象
await helper.server.world.addRoomObject(room, type, x, y, data);

// 获取房间对象
const objects = await helper.server.world.roomObjects;

// 获取房间信息
const rooms = await helper.server.world.rooms;
```

#### 玩家操作
```typescript
// 执行控制台命令
await helper.player.console('Memory.foo = "bar"');

// 获取内存
const memory = JSON.parse(await helper.player.memory);

// 获取控制台输出
const console = await helper.player.console;
```

### 示例
```typescript
describe("战斗系统", () => {
  it("应该能创建战斗小队", async function () {
    // 等待系统初始化
    for (let i = 0; i < 10; i++) {
      await helper.server.tick();
    }

    // 检查内存
    const memory = JSON.parse(await helper.player.memory);
    if (memory.combatSquads) {
      const squadCount = Object.keys(memory.combatSquads).length;
      assert.isAtLeast(squadCount, 0);
    }
  });
});
```

## 编写测试的最佳实践

### 1. 测试命名
- 使用描述性的测试名称
- 描述期望的行为，而不是实现细节

### 2. 测试结构
```typescript
describe("功能名称", () => {
  beforeEach(() => {
    // 设置测试环境
  });

  it("应该能执行特定操作", () => {
    // 测试逻辑
  });

  afterEach(() => {
    // 清理测试环境
  });
});
```

### 3. 异步测试
- 使用`async/await`处理异步操作
- 设置适当的超时时间
- 正确处理Promise

### 4. 断言
- 使用具体的断言方法
- 提供有意义的错误消息
- 测试边界条件

### 5. 模拟数据
- 创建可重用的模拟对象
- 保持模拟数据的真实性
- 避免硬编码的测试数据

## 故障排除

### 常见问题

1. **测试超时**
   - 增加超时时间：`--timeout 10000`
   - 检查异步操作是否正确等待

2. **类型错误**
   - 确保`tsconfig.test.json`配置正确
   - 检查类型定义文件

3. **集成测试失败**
   - 确保`screeps-server-mockup`已安装
   - 检查服务器状态和游戏循环

4. **内存泄漏**
   - 在`afterEach`中正确清理资源
   - 使用`helper.afterEach()`清理服务器

### 调试技巧

1. **使用console.log**
   ```typescript
   console.log("调试信息:", data);
   ```

2. **检查游戏状态**
   ```typescript
   const objects = await helper.server.world.roomObjects;
   console.log("房间对象:", objects);
   ```

3. **检查内存状态**
   ```typescript
   const memory = JSON.parse(await helper.player.memory);
   console.log("玩家内存:", memory);
   ```

## 扩展测试

### 添加新的测试文件
1. 在`test/unit/`或`test/integration/`目录下创建`.test.ts`文件
2. 导入必要的模块和断言
3. 编写测试用例
4. 运行测试验证

### 自定义测试环境
- 修改`helper.ts`添加特定的测试设置
- 在`mock.ts`中添加新的模拟对象
- 创建专门的测试配置文件

## 持续集成

测试可以集成到CI/CD流程中：

```yaml
# GitHub Actions 示例
- name: 运行测试
  run: |
    npm install
    npm test
```

## 参考资源

- [Mocha 测试框架](https://mochajs.org/)
- [Chai 断言库](https://www.chaijs.com/)
- [Screeps Server Mockup](https://github.com/Hiryus/screeps-server-mockup)
- [TypeScript 测试配置](https://www.typescriptlang.org/docs/handbook/testing.html)
