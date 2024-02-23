import {
  Message,
  FileType,
  im_proto,
  BytedIM,
  IMEvent,
  MultimediaPlugin,
} from "@volcengine/im-web-sdk";
import {
  whetherShowMessageTime,
  resetMessageLast,
  formatMessages,
  businessMessageField,
} from "./message-handle.js";

class ImSdk {
  constructor(configInfo) {
    this.APP_ID = configInfo.appId; // 替换为项目 AppId
    this.USER_ID = configInfo.userId;
    this.DEVICE_ID = configInfo.deviceId;
    this.API_DOMAIN = configInfo.apiDomain;//"https://imapi.volcvideo.com";
    this.FRONTIER_DOMAIN = configInfo.frontierDomain; //"wss://frontier-sinftob.ivolces.com/ws/v2";
    this.MESSAGES = configInfo.messages;
    this.instance = null;
    this.conversation = null;
    this.hasMoreHistory = true;
    this.cursor = null;
    this.FRIEND_ID = "";
    this.getIMTokenFunc = configInfo.getIMTokenFunc;
  }

  async init() {
    // 创建实例
    this.instance = new BytedIM(
      {
        appId: this.APP_ID,
        userId: this.USER_ID,
        deviceId: this.DEVICE_ID,
        apiUrl: this.API_DOMAIN,
        frontierUrl: this.FRONTIER_DOMAIN,
        authType: im_proto.AuthType.TOKEN_AUTH,
        debug: false, // 启用后在控制台打印详细调试信息，正式上线时建议关闭
        disableInitPull: false, // 不调用初始化接口拉消息，但是 init 还是要调用的，只是不会拉消息了
        token: () => this.fetchTokenFromServer(),
      },
      [MultimediaPlugin]
    );

    // 发起初始化请求
    await this.instance
      .init({})
      .then(() => {
        console.log("init success");
        let conversationList = this.instance.getConversationList();
        console.log("conversationList==", conversationList);
      })
      .catch((err) => {
        console.log("init fail", err);
      });
  }

 startReceiveMessages(receiveMessagesHandler, errorHandler) {
    // 订阅消息更新的事件
    this.instance.event.subscribe(IMEvent.MessageUpsert, (message) => {
      receiveMessagesHandler(message);
    });
    // 订阅消息接收失败的事件
    this.instance.event.subscribe(IMEvent.Error, async (error) => {
      console.log("IMEvent.Error", error,'error.code',error.code,'error.message',error.message);
      if(error.message.includes('EXPIRED_TOKEN')) {
        // token 过期，重新获取 token 并更新
        this.instance.ctx.cachedToken = await this.fetchTokenFromServer();
      }else {
        errorHandler(error);
      }
    });
  }

  // 从业务服务端获取 token，如果项目目前还没有后端，可以通过控制台手动获取
  async fetchTokenFromServer() {
    const Token = await this.getIMTokenFunc(this.APP_ID);
    console.log("fetchTokenFromServer Token", Token);
    if (!Token) throw new Error("需要更新业务服务端获取 token 逻辑");
    return Token;
  }

  // 控制台手动获取应用和用户的临时 token，注意应用和用户 ID 需要匹配
  // 获取地址： https://console.volcengine.com/rtc/im/appManage
  async fetchTempToken() {
    console.log("fetchTempToken");
    const tokenFromConsole =
      "Jro5x83hhblHkTvSzHngPVpw6qFMYBeeWx8VUiApszIPQUYlUgZlhF";
    if (!tokenFromConsole) throw new Error("需要手动获取 token");
    return tokenFromConsole;
  }

  /**
   * 创建会话
   * @param {*} participants 创建会话对方id
   */
  async createConversation(participants) {
    console.log("%c createConversation", "color:red",participants);
    this.FRIEND_ID = participants;
    this.cursor = null;
    /* 如果之前没有对话过，需要先创建会话 */
    this.conversation = (
      await this.instance.createConversation({ participants: [participants] })
    ).payload;
    return this.conversation;
    // if (this.conversation) {
    //   // 创建会话后 拉取sdk本地消息
    //   // await this.MESSAGES.unshift(...this.conversation.getMessageList());
    //   // formatMessages(this.MESSAGES, this.hasMoreHistory);
    //   await this.loadAndHandleMoreMessages(); // 从公司的http请求历史信息
    //   // console.log("this.conversation.getMessageList", this.MESSAGES);
    // }
  }

  /**
   * 发送文字消息
   * @param {*} content 内容
   * @param {*} ext 业务扩展字段
   */
  async sendTextMessage(content, ext) {
    let startTime = new Date().getTime();
    const message = await this.instance.createTextMessage({
      conversation: this.conversation,
      content: JSON.stringify({ text: content }),
      ext: {
        "mc:ext_json": JSON.stringify(ext), // 扩展字段，用于传递自定义数据
      },
    });

    const resp = await this.instance.sendMessage({ message });
    console.log("发送耗时", new Date().getTime() - startTime);
    console.log("sendMessage response", resp);
    return resp;
  }

  /**
   * 重新发送消息
   * @param {*} message 内容
   */
  async reSendMessage(message) {
    const resp = await this.instance.sendMessage({ message });
    console.log("reSendMessage response", resp);
    return resp;
  }

  /**
   * 发送音频消息
   * @param {*} file 需要上传的文件对象，适用于浏览器环境
   * @param {*} duration 音频长度
   */
  async sendAudioMessage(file, duration, ClientMessageID, ext) {
    let startTime = new Date().getTime();
    const message = await this.instance.createAudioMessage({
      conversation: this.conversation,
      type: im_proto.MessageType.MESSAGE_TYPE_AUDIO,
      clientId: ClientMessageID,
      fileInfo: {
        type: FileType.Audio,
        fileHandler: file,
        displayType: "media",
        audioDuration: duration,
        onUploadProcess: (res) => {
          console.log(res);
        },
      },
      ext: {
        "mc:ext_json": JSON.stringify(ext), // 扩展字段，用于传递自定义数据
      },
    });
    const resp = await this.instance.sendMessage({ message });
    console.log("发送耗时", new Date().getTime() - startTime);
    console.log("发送成功", resp);
    return resp;
  }

  /**
   * 发送自定义消息（用作语音消息传送）
   * @param {*} file 需要上传的文件对象，适用于浏览器环境
   * @param {*} duration 音频长度
   */
  async sendCustomMessage(Data, CustomMsgType, ClientMessageID, ext) {
    let startTime = new Date().getTime();
    const message = await this.instance.createCustomMessage({
      conversation: this.conversation,
      clientId: ClientMessageID,
      content: JSON.stringify({
        CustomMsgType: CustomMsgType,
        Data: JSON.stringify(Data),
      }),
      ext: {
        "mc:ext_json": JSON.stringify(ext), // 扩展字段，用于传递自定义数据
      },
    });
    const resp = await this.instance.sendMessage({ message });
    console.log("发送成功---发送耗时", new Date().getTime() - startTime, resp);
    return resp;
  }

  /**
   * 对消息进行附加操作-例如 点赞
   * @param msg
   * @param key
   * @param value
   */
  async modifyMessageProperty(msg, key, value) {
    const newMsg = await this.instance.getMessageByServerId({ conversation: this.conversation, serverMessageId: msg.serverId });
    console.log("修改消息属性 getMessageByServerId",'newMsg===',newMsg,'msg===',msg,'this.conversation===',this.conversation);
    try {
      const resp = await this.instance.modifyMessageProperty({
        message: newMsg,
        modifyContent: [
          {
            key,
            value,
            operation: 0,
            idempotentId: String(key) + this.USER_ID + value,
          },
        ],
      });
      console.log("modifyMessageProperty response", resp, msg);
      return resp;
    } catch (error) {
      console.error("Error modifying message property:", error);
      // 处理错误的逻辑
      // 例如，你可以决定抛出错误、返回一个错误对象、或者返回一个默认值
      return error;
    }
  }
  

  /**
   * 加载更多消息 从火山接口
   */
  // async loadAndHandleMoreMessages() {
  //   // 获取当前消息列表中的第一条消息的索引作为游标
  //   const cursor = this.MESSAGES?.[0]?.indexInConversation;
  //   return new Promise((resolve, reject) => {
  //     this.instance
  //       .getMessagesByConversation({
  //         conversation: this.conversation,
  //         cursor,
  //         limit: 20,
  //       })
  //       .then((response) => {
  //         // 若返回的消息列表为空，则没有更多历史消息
  //         console.log('loadAndHandleMoreMessages',response)
  //         this.hasMoreHistory = response.hasMore;
  //         if (response.messages.length > 0) {
  //           // 将新获取的消息添加到现有消息列表的前面
  //           this.MESSAGES.unshift(...response.messages);
  //           // 格式化消息
  //           formatMessages(this.MESSAGES, this.hasMoreHistory);
  //           console.log(
  //             "%c拉到历史消息了 res.messages",
  //             "color: blue",
  //             response.messages,
  //             this.MESSAGES
  //           );
  //         }
  //         resolve(response);
  //       })
  //       .catch((error) => {
  //         // 请求失败的埋点
  //         reject(error);
  //       });
  //   });
  // }

  // 从公司的http接口获取历史信息
  async loadAndHandleMoreMessages(getIMHistoryMessagesFunc) {
    // 获取当前消息列表中的第一条消息的索引作为游标
    const params = {
      "userId": this.USER_ID,
      "friendId": this.FRIEND_ID,
      "conversationShortId": this.conversation.shortId,
      "limit": 20,
      "cursor": this.cursor
    };
    return new Promise((resolve, reject) => {
     // 发起请求获取历史消息
     getIMHistoryMessagesFunc(params)
     .then((response) => {
       // 若返回的消息列表为空，则没有更多历史消息
       console.log('loadAndHandleMoreMessages',response)
       this.hasMoreHistory = response.hasMore;
       this.cursor = response.nextCursor;
       if (response.messages.length > 0) {
         // 将新获取的消息添加到现有消息列表的前面
         this.MESSAGES.unshift(...response.messages);
         // 格式化消息
         formatMessages(this.MESSAGES, this.hasMoreHistory);
         console.log(
           "%c拉到历史消息了 res.messages",
           "color: blue",
           response.messages,
           this.MESSAGES
         );
       }
       resolve(response);
     })
     .catch((error) => {
       // 请求失败的埋点
       reject(error);
     });
    });
  }
  /**
   *  Online	1	长链 push
      LoadMore	2	手动 load more 拉单链
      Init	3	初始化
      UserInbox	4	混链补偿
      Offline	5	本地创建的消息 (自己发送或 insertOfflineMessage 创建的消息)
   */
  // 是否拉取历史消息
  isLoadMore(message) {
    return message?.source === 2;
  }

  // 是否拉取历史消息
  isInit(message) {
    return message?.source === 3;
  }

  /**
   * 接收并保存消息
   * @param {*} message
   * @returns
   */

  storeMessages(message) {
    let flag = message.conversationShortId === this.conversation.shortId;
    console.log("%c storeMessages message", "color:red", message,message.conversationShortId,'this.conversation',this.conversation,this.conversation.shortId,'Is equal:',
    message.conversationShortId === this.conversation.shortId);
    if(!flag) return;
    const prevMessage = this.MESSAGES[this.MESSAGES.length - 1];
    message.time = whetherShowMessageTime(message, prevMessage);
    businessMessageField(message);
    const index = this.MESSAGES.findIndex((m) =>
      m.serverId
        ? m.serverId === message.serverId
        : m.clientId === message.clientId
    );
    if (index !== -1) {
      // 如果消息已存在，则更新消息
      this.MESSAGES[index] = Object.assign(this.MESSAGES[index], message);

      console.log(
        "storeMessages 收到发送的消息啦index",
        index,
        message,
        "flightStatus===",
        message.flightStatus,
        "source===",
        message.source,
        message.serverId,
        new Date()
      );
    } else {
      // 新发送的发送中的消息  or 接收的新消息
      this.MESSAGES.push(message);
      resetMessageLast(this.MESSAGES);
      console.log(
        "storeMessages 收到新消息啦index",
        index,
        message,
        "flightStatus===",
        message.flightStatus,
        "source===",
        message.source,
        message.serverId,
        new Date()
      );
    }
    // ai返回的 最新一条消息
    if (message.sender !== this.USER_ID) {
      message.isLast = true;
    }
  }

  /**
   * 销毁
   */
  disposeIMSdk() {
    this.instance.dispose();
  }
}

export default ImSdk;
