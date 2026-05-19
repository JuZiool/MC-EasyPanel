1. 将服务端所有需要保存的数据统一保存在server\data 目录下
2. 需要安装的库直接写进package.json文件中
3. 涉及实时通信相关需要使用websocket
4. 改动目前已有的代码时要遵循当前设计逻辑，比如注释掉的代码非必要不要取消，部分功能没限制非必要不要限制
5. 新增页面要确保于面板其它地方样式风格保持一致
6. 通知不要使用浏览器的消息组件
7. 涉及路径需要使用多个路径尝试
```typescript
const baseDir = process.cwd()
const possiblePaths = [
    path.join(baseDir, 'data', 'games', 'installgame.json'),           // 打包后的路径
    path.join(baseDir, 'server', 'data', 'games', 'installgame.json'), // 开发环境路径
]
```
8. 涉及交互弹窗的，不要使用浏览器的对话框 使用符合面板风格的弹窗组件
9. 本项目编写测试代码后应当测试成功后删除
10. 升级依赖时要注意兼容问题，不要做大版本升级，尽量修复依赖漏洞。
11. 我们的项目全程基于docker进行开发和部署
12. 提交信息使用中文