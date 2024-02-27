# Web 火山IM公共组件 API

### Props

- configInfo: 必传,火山sdk配置项
   - 类型:`Object`
   - 默认:
      - appId: 必传，火山IM的appId
            - 类型：`Number`
       
      - userId: 必传，当前用户的uid
            - 类型：`String`
                
      - deviceId: 必传，当前的设备id
            - 类型：`String`

      - appArea: 必传，sdk的运行区域(影响火山sdk的apiUrl和frontierUrl),zh是国内,其他的都是国外(eg: ja/en)
            - 类型：`String`
            - 默认：`zh`
          
      - messages: 必传，消息列表
            - 类型：`Array`
   
      - getIMTokenFunc: 必传，获取IM token的函数
            - 类型：`Function`
       
### Events

| 事件名       | 说明   |入参  | 入参类型 | 回调参数                                                                    |
| ------------ | -------- | ---------------------------|------------------------|------------------------ |
| createConversation | 创建会话  | participants 创建会话对方id | `String` | conversation 创建成功返回的会话对象 |
| loadAndHandleMoreMessages    | 拉取历史记录 |  getIMHistoryMessagesFunc http的拉取历史记录的方法 | `Function` | Promise(response:拉取历史消息成功的回调/error:拉取历史消息失败的回调)                                                                          |
| sendTextMessage | 发送文本消息     | content 文本内容, ext 扩展内容() | content `String`; ext `Json`|response 发送文本消息结果                                                 |
|reSendMessage|重新发送消息|message 内容 | message 消息体 |response 重新发送消息结果
|sendCustomMessage|发送自定义消息|Data 内容;CustomMsgType 自定义消息类型;ClientMessageID 消息的clientID;ext 自定义扩展字段 | Data `String`; CustomMsgType `Number`;ClientMessageID `String`;ext `Json` |response 发送自定义消息结果 
| modifyMessageProperty | 对消息进行附加操作-例如 点赞  | msg 消息体; key 操作行为的key; value 操作行为的value | msg `Message`消息体; key `String`; value `String` | response 操作成功的返回对象; error 操作失败的返回|
| storeMessages | 接收并保存消息  | message 消息体 | message `Message`消息体;  | -|
| isLoadMore | 是否拉取历史消息  | message 消息体 | message `Message`消息体;  | -|
| isInit | 是否初始化拉取的消息  | message 消息体 | message `Message`消息体;  | -|
| disposeIMSdk | sdk销毁  | - | - | -|

:::tip

```
import {ImSdk} from "hakkoai-im-sdk";
```

:::