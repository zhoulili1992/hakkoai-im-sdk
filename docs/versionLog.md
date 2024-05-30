#### 版本日志

#### v1.0.0
- 初始化项目(支持消息收发以及消息的格式化处理)

#### v1.0.1
- 增加语音消息
- appArea兼容

#### v1.0.2
- 增加generation_source字段
  
#### v1.0.3
- 

#### v1.0.4
- 开放 formatMessages方法
- 去掉某些log

#### v1.0.5
- 增加parseJsonIfPossible方法(兼容app端数据结构是json对象和json字符串)

#### v1.0.6
- messsage增加角色相关字段(语言/名字/语速)
- 优化消息是否存在-conversationShortId/conversationId同时兼容
- 优化更新消息的方法(某些已读字段无法直接赋值,用新的代替旧数据)
- 消息转化增加try-catch
  
#### v1.0.7
- 优化更新消息的方法

#### v1.0.8
- 优化更新消息的方法
- 优化resetMessageLast
  
#### v1.0.9
- 优化消息时间设置