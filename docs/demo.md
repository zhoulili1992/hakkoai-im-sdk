```
async function setupImSdk() {
    let configInfp = {
        appId: process.env.NODE_ENV === "development" ? 889237 : 889169,
        userId: userStore.userInfo.web_user_id,
        deviceId: userStore.header["Device-Identifier"],
        apiDomain: "https://imapi.volcvideo.com",
        frontierDomain: "wss://frontier-sinftob.ivolces.com/ws/v2",
        messages: messages.value,
        getIMTokenFunc: getIMToken
    }
    imSdk = new ImSdk(configInfp);
    console.log("imSdk===", imSdk);
    await imSdk.init();
    imSdk.startReceiveMessages(
        (message) => {
            // ...处理接收到的消息...
            if (imSdk.isLoadMore(message) || imSdk.isInit(message)) return;
            imSdk.storeMessages(message);
            console.log(messages.value.length, max_chat_history_number.value);
            if (
              !userStore.userInfo.is_superuser &&
              messages.value.length >= max_chat_history_number.value
            ) {
              endTheExperience();
            }
            if (!message.isFromMe) {
                console.log("%c消息更新 MessageUpsert", "color:red", message);
                isReceiving.value = false;
                if (message.messageType !== 1) {
                    // 剔除主动推荐消息
                    // 消息接收任务上报
                    reportReceiveServerMessage(message);
                    // 埋点
                    window.collectEvent("invite_im_web_receiveAIResponse", {
                      message: message?.text,
                  });
                }
            } else {
                console.log("mineMessageRefs", mineMessageRefs);
                console.log(
                    "%c消息更新 MessageUpsert",
                    "color:blue",
                    message,
                    "message.flightStatus",
                    message.flightStatus,
                    "message.soucre",
                    message.source
                );

                const mineMessageRef = mineMessageRefs.value[message.serverId];
                if (mineMessageRef) {
                    // Call a method on the mineMessage component
                    mineMessageRef.resetMineMessageState(message);
                }
            }

            scrollToBottom();
        },
        (error) => {
            // ...处理接收消息时的错误...
            console.log("im_sdk error", error);
            window.collectEvent("im_message_sdk_error", {
                error: error.message,
            });
            // ElMessage.error(error.message);
        }
    );
    await initConversation(userStore.userInfo.character_being_used);
}

// 初始化会话(创建聊天以及拉取历史)
async function initConversation(participants) {
    console.log("initConversation", participants);
    let conversation = await imSdk.createConversation(participants);
    if(conversation) {
        await getHistory();
    }
    setTimeout(() => {
        scrollToBottom(); 
    }, 100);
}

// 获取历史消息
async function getHistory() {
    refreshing.value = true;
    const oldScrollHeight = chatHistory.value.scrollHeight;
    imSdk
        .loadAndHandleMoreMessages(getIMHistoryMessages)
        .then((response) => {
            refreshing.value = false;
            // 更新滚动位置以保持当前视图
            const newScrollHeight = chatHistory.value.scrollHeight;
            const scrollTop = newScrollHeight - oldScrollHeight;
            chatHistory.value.scrollTop = scrollTop;
            // 如果没有历史消息，发送一条ai消息
            if (messages.value.length === 0){
              handleSendAiMessage()
            }else {
              if (
                messages.value.length >= max_chat_history_number.value
              ) {
                if (!userStore.userInfo.is_superuser) {
                  endTheExperience();
                }
              }
            };
        })
        .catch((error) => {
            refreshing.value = false;
            // 获取历史消息的失败事件
            window.collectEvent("invite_im_web_error", {
            api: "getChatHistory",
            error,
          });
        });
}

// 发送消息
async function sendMessage(isRecommendedReply = false) {
    const userMessage = userInput.value.trim();
    if (userMessage) {
        const ext = {
            route: "",
            subject_dialogue_id:
                isRecommendedReply === true
                    ? lastTopicSubjectDialogueId.value
                    : "",
            device_identifier: userStore.header["Device-Identifier"],
            app_version: userStore.header["App-Version"],
            app_platform: userStore.header["App-Platform"],
            area: userStore.header["Area"],
            language: userStore.header["Lan"],
            message_source: "pc-invite-im", // 消息来源; 原生IM聊天框传windows-im; 原生模型聊天传windows-native;移动邀请页传mobile-invite-im;pc端邀请页传pc-invite-im;移动端mobile-im
        };
        const res = await imSdk.sendTextMessage(userMessage, ext);
        if (
          !userStore.userInfo.is_superuser &&
          messages.value.length >= max_chat_history_number.value
        ) {
          endTheExperience();
        }
        window.collectEvent("invite_im_web_message_send", {
          sender: userStore.userInfo.web_user_id,
          receiver: userStore.userInfo.character_being_used,
          createAt: Math.floor(new Date().getTime() / 1000),
          text: userMessage,
          clientMessageId: res.payload.clientId,
        });
        if (res.success === false) {
            if (res?.statusCode === 1008) {
                ElMessage.error(t("network.unavailable"));
            } else {
                ElMessage.error(res?.innerError?.message || "Unknown error");
            }
        } else {
            isReceiving.value = true; // 发送成功,显示接收中...动画
            scrollToBottom();
        }
        console.log("sendMessage res", res);
    }
}

//消息失败后重发
async function reSendMessage(message) {
    const res = await imSdk.reSendMessage(message);
    window.collectEvent("invite_im_web_message_resend", {
      clientMessageId: message.serverId,
    });
    if (res.success === false) {
        if (res?.statusCode === 1008) {
            ElMessage.error(t("network.unavailable"));
        } else {
            ElMessage.error(res?.innerError?.message || "Unknown error");
        }
        window.collectEvent("im_messgae_reSend_failed", {
            // 重发消息失败
            clientMessageId: message.clientId,
        });
    } else {
        isReceiving.value = true; // 发送成功,接收中...动画
        scrollToBottom();
    }
    console.log("reSendMessage res", res, message);
}

```