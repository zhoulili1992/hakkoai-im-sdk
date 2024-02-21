import { dateFormat } from "./tool";

/* 根据消息类型获取文本内容
 * @param {*} message 当前消息
 */
function getMessageText(message) {
  if(!message.content) return;
  let msgContent = JSON.parse(message.content);
  if (message.type === 10001) {
    // 文本消息
    return msgContent.text;
  } else if (message.type === 10012) { // 自定义的多媒体消息
    let text = "";
    if(msgContent.CustomMsgType === 10006) { // 语音消息
      if (
        message.ext["mc:ext_json"] &&
        JSON.parse(message.ext["mc:ext_json"]).audio_text
      ) {
        text = JSON.parse(message.ext["mc:ext_json"]).audio_text;
      }
    } 
    return text;
  } else {
    return "";
  }
}

/* 根据消息类型获取语音内容
 * @param {*} message 当前消息
 */
function getMessageAudio(message) {
  const audio = {};
  if (message.type === 10006) {
    // 语音消息
    const extContent = JSON.parse(message.content);
    audio.id =
      extContent.__files.media?.ext["s:file_ext_key_source_app_id"] || "";
    const duration =
      extContent.__files.media?.ext["s:file_ext_key_audio_duration"];
    audio.duration = duration;

    audio.formatDuration = formatDuration(duration);
    audio.width = calculateWidth(duration);
    audio.url = extContent.__files.media?.remoteURL;
    // 语音消息
    if (message.isFromMe) {
      audio.name = extContent.__files.media.ext["s:file_ext_key_vid"] || "";
    } else {
      audio.name =
        extContent.__files.media.ext["s:file_ext_key_file_name"] || "";
      audio.audioText = JSON.parse(message.ext["mc:ext_json"]).audio_text;
    }
  }
  console.log("getMessageAudio audio", message, audio);
  return audio;
}

/**
 * 格式化当前消息的时长 秒取整
 * @param {*} duration 当前消息时长
 */
function formatDuration(duration) {
  if (!duration) {
    return "0'";
  }
  // 首先，将字符串转换为浮点数
  const seconds = parseFloat(duration);

  // 计算分钟和剩余的秒数
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  // 格式化输出
  return `${minutes > 0 ? `${minutes}'` : ""}${remainingSeconds}''`;
}

/**
 * 格式化当前消息的宽度
 * @param {*} duration 当前消息时长
 */
function calculateWidth(duration) {
  if (!duration) {
    return 20;
  }
  // 将字符串转换为浮点数
  const seconds = parseFloat(duration);
  // 计算宽度
  let width = seconds * 20; // 1s宽20px
  // 如果宽度超过最大值，则限制宽度
  width = Math.min(width, 200); // 最大宽200px
  return width;
}

/**
 * 当条消息是否展示时间  与传入的前一条消息比较
 * @param {*} message 当前消息
 * @param {*} prevMessage  上一条消息
 */
function whetherShowMessageTime(message, prevMessage) {
  if (!prevMessage) {
    return dateFormat(message?.createdAt.valueOf());
  }
  const timeDifference = Math.abs(
    prevMessage?.createdAt.valueOf() - message?.createdAt.valueOf()
  );
  // 计算两个消息的时间差，单位是毫秒
  const timeDifferenceInMinutes = timeDifference / (60 * 1000); // 将毫秒转换为分钟
  if (timeDifferenceInMinutes > 3) {
    // 3分钟之内不显示时间
    // 如果时间差大于3分钟，就在当前消息的后面加上时间显示
    return dateFormat(message?.createdAt.valueOf());
  } else {
    return "";
  }
}

/**
 * 是否最后一条消息
 * @param {*} messages 消息列表
 */
function resetMessageLast(messages) {
  messages.forEach((message) => {
    message.isLast = false;
  });
}

/**
 * 格式化历史信息显示 (是否当前用户发送的  消息显示时间与否)
 * @param {*} messages 消息列表
 */
function formatMessages(messages, hasMoreHistory) {
  if (messages.length === 0) return;
  messages.forEach((message, index) => {
    message.isLast = false;
    if (index >= 1) {
      const prevMessage = messages[index - 1];
      message.time = whetherShowMessageTime(message, prevMessage);
    }

    // 第一条消息显示时间
    if (hasMoreHistory === false && index === 0) {
      message.time = dateFormat(message?.createdAt.valueOf());
    }
    if (index === messages.length - 1 && message.isFromMe === false) {
      message.isLast = true;
    }
    // console.log("message.time====", message.time);
    // 格式化消息 业务
    businessMessageField(message);
  });
}

// 格式化业务字段 方便使用
function businessMessageField(message) {
  const extContent = message.ext["mc:ext_json"] && JSON.parse(message?.ext["mc:ext_json"]);
  if (!extContent) return;
  message.subjectRecommendsList = extContent?.subject_recommends || [];
  message.likeType = "0";
  if (message.property.like && message.property.like.length > 0) {
    message.likeType = message.property.like[0].value;
  }
  message.messageType = extContent?.message_type;
  message.linkContent = extContent?.link_content;
  message.chatTitle = extContent?.chat_title;
  message.audioText = extContent?.audio_text;
  message.text = getMessageText(message);
}

function resetMessageState(message) {
  if (!message.isFromMe) return;
  message.isSending = false;
  message.isError = false;
  if (
    message.flightStatus === 0 ||
    message.flightStatus === 1 ||
    message.flightStatus === 2
  ) {
    //
    message.isSending = true;
    message.isError = false;
  } else if (message.flightStatus === -1 || message.flightStatus === -2) {
    message.isError = true;
    message.isSending = false;
  }
  console.log(
    "resetMessageState ",
    message,
    message.isSending,
    message.isError
  );
}

export {
  getMessageText,
  whetherShowMessageTime,
  resetMessageLast,
  formatMessages,
  getMessageAudio,
  businessMessageField,
  resetMessageState,
};
