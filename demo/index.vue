<!-- 聊天页面 -->
<template>
    <div
        class="ai-chat"
        :style="{
            background: `linear-gradient(rgba(15, 15, 18, 0.5), rgba(15, 15, 18, 0.5)), url(${protraitImg}) right calc(100% - 66px)/contain no-repeat`,
        }"
        :class="{ allowUserSelect: isEditMode }"
    >
        <div v-if="privateModeSwitchOn" class="private-mode">
            <div class="private-tip" @click="handleViewHistory">
                {{ $t("privateMode.tip") }}
            </div>
        </div>
        <div
            class="chat-history"
            ref="chatHistory"
            @scroll="handleScroll"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
        >
            <!-- AI提示 -->
            <div v-if="!imSdk.hasMoreHistory && !privateModeSwitchOn " class="ai-tip">
                {{ $t("tip.aiTip") }}
            </div>
            <!-- 刷新动画图标 -->
            <img
                v-if="refreshing && !privateModeSwitchOn"
                class="spinner"
                src="@/assets/img/loading@2x.png"
            />
            <!-- 聊天列表 -->
            <div
                v-for="message in messages"
                :key="message.serverId"
                class="message"
            >
                <AiMessage
                    class="ai-message"
                    :id="message.serverId"
                    :message="message"
                    v-if="message.isFromMe === false"
                    @like-message="likeMessage"
                    @tease-message="teaseMessage"
                    @link-message="linkMessage"
                    @share-message="shareMessage"
                    @choose-message="chooseMessage"
                >
                </AiMessage>
                <mineMessage
                    :ref="(el) => setMineMessageRef(el, message.serverId)"
                    class="mine-message"
                    :id="message.serverId"
                    :message="message"
                    @re-send-message="reSendMessage"
                    @choose-message="chooseMessage"
                    v-else
                >
                </mineMessage>
            </div>
            <!-- AI输入中 ...动画 -->
            <div v-if="isReceiving" class="receiving">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
        <!-- 话题推荐 -->
        <div v-if="isEditMode" class="edit-tip">
            {{ $t("mesage.currentChooseTipStart") }}
            <span class="edit-count-tip">{{ editMessageList.length }}</span>
            {{
                editMessageList.length < 2
                    ? $t("mesage.currentChooseTipEnd")
                    : $t("mesage.currentChooseTipEndPlural")
            }}
        </div>
        <TopicRecommend
            v-if="!isEditMode"
            :topic-list="topicList"
            :is-loading-topic="isLoadingTopic"
            :is-new-topic="isNewTopic"
            @select-topic="selectTopic"
            @reload-topic="reloadTopic"
            @confirm-notRemind="hanldeConfirmReloadTopicDialog"
        ></TopicRecommend>
        <!-- 聊天编辑框 -->
        <ChatEdit @send-message="sendInputMessage"> </ChatEdit>
        <!-- 调教反馈 -->
        <FeedBack
            :dialogVisible="dialogVisible"
            :message="feedbackMessage"
            @submit-feed-back="submitFeedBack"
            @close-feed-back="closeFeedBack"
        ></FeedBack>
        <!-- 分享的操作栏 -->
        <ChatOperate
            class="operate"
            v-if="isEditMode"
            @create-picture="createPicture"
            @cancle-operate="cancleOperate"
        ></ChatOperate>
        <ChatShare
            v-if="isShareChat"
            :share-message-list="editMessageList"
            @save-chat-picture="saveChatPicture"
            @cancal-save-chat-picture="cancleSaveChatPicture"
        ></ChatShare>
        <PrivacyDialog :modelValue="isPrivacyDialogVisible" @confirm="hanleVerifyPwd" @cancel="handleCancelVerifyPwd" @forgotPwd="handleForgotPwd"></PrivacyDialog>
    </div>
</template>
  
<script setup>
import {
    ref,
    nextTick,
    computed,
    onMounted,
    onBeforeUnmount,
    reactive,
    onBeforeMount,
} from "vue";

// 工具
import { useUserStore } from "@/stores/userStore";
import { getUserInfo, getCharacterInfo } from "@/apis/user-center";
import { reportUserAction } from "@/apis/report-action.js";
import { startLoading, endLoading } from "@/utils/loading";
import { getRecommendSubjects } from "@/apis/im-chat.js";
import { getWV2 } from "@/utils/message-link";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import ImSdk from "@/utils/imSdk";
import { verifyPrivatePassword } from "@/apis/privacy.js";
import { getQueryString } from "@/utils/tool.js";
import CryptoJS from 'crypto-js';
import { getIMToken, getIMHistoryMessages } from "@/apis/im-chat.js";

// 页面
import AiMessage from "./text-type/ai-message.vue";
import mineMessage from "./text-type/mine-message.vue";
import FeedBack from "./feed-back.vue";
import TopicRecommend from "./topic-recommend.vue";
import ChatEdit from "./chat-edit.vue";
import ChatOperate from "./chat-operate.vue";
import ChatShare from "./chat-share.vue";
import PrivacyDialog from "@/views/chat/privacy-protection/privacy-dialog.vue";

const userStore = useUserStore();
const { t } = useI18n();
let imSdk = reactive({});
let nativeInteropHelper = null;
const isEditMode = ref(false); // 是否分享的编辑状态
const isShareChat = ref(false); // 是否显示 分享聊天的页面
let isMouseDown = ref(false); // 鼠标是否按下
const chatHistory = ref(null);
const userInput = ref("");
const refreshing = ref(false);
const isFirstLoad = ref(true);
const isReceiving = ref(false);
const dialogVisible = ref(false);
var feedbackMessage = ref({});
// 当前推荐的话题
const topicList = ref([]);
const isNewTopic = ref(true);
const lastTopic = ref({}); // 最新的一个在聊话题
const lastTopicSubjectDialogueId = ref(""); // 最新的一个在聊话题的聊天id
const isLoadingTopic = ref(false); // 正在刷新话题

const privateModeSwitchOn = ref(false); // 是否是私聊模式
const isPrivacyDialogVisible  = ref(false); // 是否显示隐私弹窗

const hasMoreTopic = ref(true);
const protraitImg = ref(""); // 立绘图
var messages = reactive([]); // 当前页面显示的聊天记录
var allMessages = reactive([]); // 用户所有的聊天记录
var provicyMessages = reactive([]); // 隐私模式后 新的聊天记录


const mineMessageRefs = ref({});
// 编辑状态的消息列表
const editMessageList = computed(() => {
    return messages.filter((message) => message.isChoosed === true);
});

// 隐私模式查看历史记录
function handleViewHistory() {
    console.log('handleViewHistory',privateModeSwitchOn.value )
    isPrivacyDialogVisible.value = true;
    window.collectEvent(
                "click_view_privacy_history",
                {from:"windows-im"}
    );
}

// 滚动事件
async function handleScroll() {
    if (!imSdk.hasMoreHistory || refreshing.value) {
        // 没有更多历史消息 正在刷新中 直接返回
        return;
    }
    const container = chatHistory.value;
    if (container.scrollTop <= 1) {
        console.log(
            "Starting refresh...",
            "container.scrollTop",
            container.scrollTop
        );

        await getHistory();
        window.collectEvent("im_message_refreshList");
    }
}

// 获取历史消息
async function getHistory() {
    refreshing.value = true;
    const oldScrollHeight = chatHistory.value.scrollHeight;
    window.collectEvent('im_message_get_chatHistoryList', {
        time: new Date().getTime(),
    });
    imSdk
        .loadAndHandleMoreMessages(getIMHistoryMessages)
        .then((response) => {
            refreshing.value = false;
            // 更新滚动位置以保持当前视图
            const newScrollHeight = chatHistory.value.scrollHeight;
            const scrollTop = newScrollHeight - oldScrollHeight;
            chatHistory.value.scrollTop = scrollTop;
            setupMessages();
            // 历史记录 选择消息模式下
            setMessagesEditMode(isEditMode.value);
            // 成功获取历史消息的事件
            window.collectEvent("im_message_get_chatHistoryList_successed", {
                time: new Date().getTime(),
            });
        })
        .catch((error) => {
            refreshing.value = false;
            // 获取历史消息的失败事件
            window.collectEvent("im_message_get_chatHistoryList_failed", {
                error: error,
                time: new Date().getTime(),
            });
        });
}

// 是进行中的话题还是新的话题
function topicState(message) {
    console.log("topicState===", message);
    if (!message) return;
    if (
        message.subjectRecommendsList &&
        message.subjectRecommendsList.length > 0
    ) {
        // 进行中的话题
        topicList.value = message.subjectRecommendsList;
        isNewTopic.value = false;
        // lastTopic.value = message.serverMessage.subjectRecommendsList[0];
        lastTopicSubjectDialogueId.value =
            message.subjectRecommendsList[0]?.subject_dialogue_id;
        userInput.value = isNewTopic
            ? ""
            : message.subjectRecommendsList[0]?.subject_dialogue_content;
    } else {
        // 新话题
        lastTopicSubjectDialogueId.value = "";
        isNewTopic.value = true;
        console.log("lastTopic.value===", lastTopic.value);
        if (lastTopic.value?.subject_id) {
            return;
        }
        if (!hasMoreTopic.value) return;
        console.log("topicState hasMoreTopic.value===", hasMoreTopic.value);
        getRecommendTopicList(false);
    }
}

// 话题推荐
function getRecommendTopicList(refresh) {
    isLoadingTopic.value = true;
    const params = {
        user_id: userStore.userInfo.web_user_id,
        friend_id: userStore.userInfo.character_being_used,
        last_subject_id: lastTopic.value?.subject_id,
    };
    getRecommendSubjects(params, (err, response) => {
        isLoadingTopic.value = false;
        if (err) {
            // 处理错误
            window.collectEvent("im_message_get_recommend_subject_failed", {
                error: err,
            });
        } else {
            // 处理成功的响应
            console.log("getRecommendSubject response", response);
            topicList.value = response.payload.subjects;
            if (topicList.value.length > 0) {
                hasMoreTopic.value = true;
                const topic = topicList.value[0];
                lastTopic.value = topic;
            } else {
                hasMoreTopic.value = false;
                if (refresh === true) {
                    ElMessage({
                        showClose: false,
                        message: t("topic.noMoreTopics"),
                        type: "warning",
                    });
                }
            }
            console.log("hasMoreTopic.value==", hasMoreTopic.value);
            window.collectEvent("im_message_get_recommend_subject_successed");
        }
    });
}

/* 鼠标操作相关事件 */
function handleMouseDown(event) {
    // 鼠标按下
    if (isEditMode.value === false) return;
    isMouseDown.value = true;
    console.log("handleMouseDown");
}

function handleMouseMove(event) {
    // 鼠标滑动
    if (isEditMode.value === false) return; // 非编辑模式 直接返回
    if (isMouseDown.value === false) return; // 鼠标未按下 直接返回
    console.log("handleMouseMove", event);
    const selectedItem = document.elementFromPoint(
        event.clientX,
        event.clientY
    );
    if (selectedItem) {
        if (editMessageList.value.length >= 20) {
            // ElMessage.error(t("mesage.maxChoosedTip"));
            return;
        }
        const foundMessage = messages.find(
            (message) => message.serverId === selectedItem.id
        );
        if (foundMessage) {
            foundMessage.isChoosed = true;
        }
    }
}

function handleMouseUp() {
    // 鼠标抬起
    isMouseDown.value = false;
    console.log("handleMouseUp");
}

// 消息点赞
async function likeMessage(message) {
    console.log("likeMessage before", message);
    window.collectEvent('im_message_like', {
        message_id: message.serverId,
        im_type: message.im_type,
    });
    if (message.im_type === 0) {
        // 以前的历史消息 火山不兼容
        message.likeType = "1";
        ElMessage({
            showClose: false,
            message: t("network.succeededLike"),
            type: "success",
        });
        return;
    }
    const key = "like";
    const value = "1";
    imSdk
        .modifyMessageProperty(message, key, value)
        .then((res) => {
            console.log("消息属性修改成功:", res);

            // const res = await imSdk.modifyMessageProperty(message, key, value);
            if (res?.success === false) {
                ElMessage.error(t("network.failedLike"));
                window.collectEvent("im_message_like_failed", {
                    // 点赞失败的埋点
                    message_id: message.serverId,
                });
            } else {
                message.likeType = "1";
                // 处理成功的响应
                ElMessage({
                    showClose: false,
                    message: t("network.succeededLike"),
                    type: "success",
                });
                window.collectEvent("im_message_like_successed", {
                    message_id: message.serverId,
                });
            }
        })
        .catch((error) => {
            console.error("消息属性修改失败:", error);
            ElMessage.error(t("network.failedLike"));
        });
}

// 消息调教
function teaseMessage(message) {
    feedbackMessage.value = message;
    dialogVisible.value = true;
    window.collectEvent("im_message_feedback", {
        message_id: message.serverId,
    });
}

// 消息链接点击
function linkMessage(link) {
    if (link) {
        nativeInteropHelper.WebLink(link);
        window.collectEvent('im_message_link', {
            link: link,
        });
    }
}

// 消息分享
function shareMessage(message) {
    // 点击 分享 按钮
    isEditMode.value = true;
    setMessagesEditMode(isEditMode.value);
    window.collectEvent("im_message_clickShare", {
        message_id: message.serverId,
        character_id: userStore.userInfo.character_being_used,
        share_time: new Date().getTime(),
    });
}

function setMessagesEditMode(isEdit) {
    // 设置消息是否编辑状态
    messages.forEach((message, index) => {
        message.isEdit = isEdit;
    });
}

// 编辑状态下-消息选择
function chooseMessage(message) {
    // 多选
    if (message.isChoosed) {
        message.isChoosed = false;
    } else {
        message.isChoosed = true;
    }
    let choosedLength = 0;
    messages.forEach((message, index) => {
        if (message.isChoosed) {
            choosedLength++;
        }
    });
    if (choosedLength > 20) {
        ElMessage.error(t("mesage.maxChoosedTip"));
        message.isChoosed = false;
    }
}

function setMineMessageRef(el, serverId) {
    if (el) {
        mineMessageRefs.value[serverId] = el;
    } else {
        delete mineMessageRefs.value[serverId];
    }
}
/* 话题推荐相关 */
// 点击推荐话题
function selectTopic(topic) {
    console.log("selectTopic===", topic);
    userInput.value = topic.subject_dialogue_content;
    lastTopic.value = {};
    lastTopicSubjectDialogueId.value = topic.subject_dialogue_id;
    sendMessage(true);
    window.collectEvent("im_message_selectRecommendTopic", topic);
}

// 重新加载推荐话题
function reloadTopic(reloadTopicDialogVisible) {
    console.log("reloadTopicDialogVisible====", reloadTopicDialogVisible);
    if (reloadTopicDialogVisible === false) {
        getRecommendTopicList(true);
        isNewTopic.value = true;
    }
    window.collectEvent("im_message_reloadTopic", {
        reloadTopicDialogVisible: reloadTopicDialogVisible,
    });
}

// 确认重新加载推荐话题
function hanldeConfirmReloadTopicDialog() {
    getRecommendTopicList(true);
    isNewTopic.value = true;
}

/* 发送消息*/
function sendInputMessage(userMessage) {
    userInput.value = userMessage;
    sendMessage();
}
// 发送消息
async function sendMessage(isRecommendedReply = false) {
    const userMessage = userInput.value.trim();
    if (userMessage) {
        const ext = {
            route: userStore.header["ROUTE"],
            subject_dialogue_id:
                isRecommendedReply === true
                    ? lastTopicSubjectDialogueId.value
                    : "",
            device_identifier: userStore.header["device-identifier"],
            app_version: userStore.header["app-version"],
            app_platform: userStore.header["app-platform"],
            area: userStore.header["area"],
            language: userStore.header["lan"],
            message_source: "windows-im", // 消息来源; 原生IM聊天框传windows-im; 原生模型聊天传windows-native;移动邀请页传mobile-invite-im;pc端邀请页传pc-invite-im;移动端mobile-im
        };
        const res = await imSdk.sendTextMessage(userMessage, ext);
        window.collectEvent('im_message_send', {
            sender: userStore.userInfo.web_user_id,
            receiver: userStore.userInfo.character_being_used,
            createAt: Math.floor(new Date().getTime() / 1000),
            text: JSON.parse(res.payload?.content)?.text,
            clientMessageId: res.payload.clientId,
        });
        window.collectEvent('send_msg', {
            sender: userStore.userInfo.web_user_id,
            receiver: userStore.userInfo.character_being_used,
            createAt: Math.floor(new Date().getTime() / 1000),
            text: JSON.parse(res.payload?.content)?.text,
            clientMessageId: res.payload.clientId,
            im_type:"windows-im",
            msg_type: "Text",
        });
        if (res.success === false) {
            if (res?.statusCode === 1008) {
                ElMessage.error(t("network.unavailable"));
            } else {
                ElMessage.error(res?.innerError?.message || "Unknown error");
            }
            window.collectEvent("im_messgae_send_failed", {
                // 发动失败的埋点
                clientMessageId: res.payload.clientId,
            });
        } else {
            isReceiving.value = true; // 发送成功,显示接收中...动画
            window.collectEvent("im_message_send_successed", {
                // 发送成功的埋点
                clientMessageId: res.payload.clientId,
            });
        }
        console.log("sendMessage res", res);
    }
}

//消息失败后重发
async function reSendMessage(message) {
    const res = await imSdk.reSendMessage(message);
    window.collectEvent('im_message_resend', {
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
        window.collectEvent("im_message_reSend_successed", {
            // 重发消息成功
            clientMessageId: message.clientId,
        });
    }
    console.log("reSendMessage res", res, message);
}

/* 用户调教反馈相关 */
function submitFeedBack() {
    dialogVisible.value = false;
}

function closeFeedBack() {
    dialogVisible.value = false;
}

/* 分享操作相关 */
function createPicture() {
    // 生成长图
    if (editMessageList.value.length === 0) {
        isEditMode.value = false;
        setMessagesEditMode(isEditMode.value);
        return;
    }

    isShareChat.value = true;
    window.collectEvent("im_message_createPicture", {
        message_list: editMessageList.value.map((message) => message.serverId),
        character_id: userStore.userInfo.character_being_used,
        share_time: new Date().getTime(),
    });
}

function cancleOperate() {
    // 取消
    isEditMode.value = false;
    setMessagesEditMode(isEditMode.value);
    isShareChat.value = false;
    setMessagesChoosedState(false);
    editMessageList.value.splice(0);
    window.collectEvent("im_message_cancleShare", {});
}

function setMessagesChoosedState(isChoosed) {
    // 设置消息是否选中状态
    messages.forEach((message, index) => {
        message.isChoosed = isChoosed;
    });
}

function saveChatPicture() {
    // 保存图片
    isEditMode.value = false;
    setMessagesEditMode(isEditMode.value);
    isShareChat.value = false;
    setMessagesChoosedState(false);
    editMessageList.value.splice(0);
    reportSaveShareRecord();
}

function reportSaveShareRecord() {
    const reportItem = {
        action_type: "SHARE_RECORD", // 具体类型从/api/users/get_action_config接口获取到的列表查看
        action_type_value: 12,
        character_id: userStore.userInfo.character_being_used,
        action_content: {},
        action_time: Math.floor(new Date().getTime() / 1000),
    };
    reportUserAction(reportItem, (err) => {
        if (err) {
            // 处理错误
            window.collectEvent("im_message_report_save_hare_record_failed", {
                time: Math.floor(new Date().getTime() / 1000),
                error: err,
            });
        } else {
            // 处理成功的响应
            window.collectEvent(
                "im_message_report_save_hare_record_successed",
                {
                    time: Math.floor(new Date().getTime() / 1000),
                }
            );
        }
    });
}

function cancleSaveChatPicture() {
    // 取消保存图片
    // isEditMode.value = false;
    // setMessagesEditMode(isEditMode.value);
    isShareChat.value = false;
    // setMessagesChoosedState(false);
    // editMessageList.value.splice(0);
    window.collectEvent("im_message_cancleSavePicture", {});
}

/ * 隐私模式相关 */
function hanleVerifyPwd(password) {
    console.log("handleVerifyPwd",password);
    const params = {
      "password": CryptoJS.MD5(password).toString(),
    };
    verifyPrivatePassword(params,(err, response) => {
        if (err) {
            // 处理错误
            window.collectEvent(
                "verify_privacy_password_failed",
                {from:"windows-im"}
            );
            console.log("verifyPrivatePassword failed", err);
        } else {
            // 处理成功的响应
            privateModeSwitchOn.value = false;
            isPrivacyDialogVisible.value = false;
            setupMessages();
            scrollToBottom();
            nativeInteropHelper.IMVerifyPrivatePasswordSucceedCmd();
            window.collectEvent(
                "verify_privacy_password_successed",
                {from:"windows-im"}
            );
            console.log("verifyPrivatePassword successed", err);
        }
    });
}

function handleCancelVerifyPwd() {
    isPrivacyDialogVisible.value = false;
    window.collectEvent(
                "cancle_verify_privacy_password",
                {from:"windows-im"}
    );
}

function handleForgotPwd() { //忘记密码与原生通讯
    nativeInteropHelper.IMForgetPasswordCmd();
    isPrivacyDialogVisible.value = false;
    window.collectEvent(
                "verify_page_forget_privacy_password",
                {verify_type:"PrivacyPasswordType",from:"windows-im"}
    );
}

/ * 生命周期相关 */
onBeforeMount(async () => {
    nativeInteropHelper = await getWV2();
    userStore.header = await getHeader();
    console.log("userStore.header", userStore.header);
    await requestUserInfo();
    getNativePrivateConfig();
    setupImSdk();
});

const getHeader = async () => {
    let webview_header;
    try {
        webview_header = await nativeInteropHelper.GetHeader();
        return JSON.parse(webview_header);
    } catch (e) {
        return {};
    }
};

// 获取用户信息
async function requestUserInfo() {
    // 返回一个 Promise
    return new Promise((resolve, reject) => {
        // 调用 getUserInfo 异步函数
        getUserInfo((err, response) => {
            if (err) {
                // 处理错误并拒绝 Promise
                ElMessage.error(err.message);
                reject(err);
            } else {
                // 处理成功的响应并解决 Promise
                userStore.userInfo = response.payload;
                userStore.userInfo.character_being_used =
                    userStore?.userInfo?.character_being_used?.toString();
                userStore.userInfo.character_language =
                    response?.payload?.character_language;
                console.log("requestUserInfo.response", response);
                window.collectEvent("config", {
                    dev_env:
                        process.env.NODE_ENV === "development"
                            ? "dev"
                            : "online",
                    user_unique_id: response?.payload?.web_user_id,
                    app_region: userStore?.header["area"],
                    device_id: userStore?.header["device-identifier"],
                    platform_source: userStore?.header["platform-source"], // 增加平台来源 区分wind7和windows其他的
                    im_source: "huoshan", //前期区分聊天信息数据来源 
                    app_version: userStore?.header["app-version"],
                    dataApp_id: userStore?.header["data-appid"],
                });
                resolve(response);
                requestCharacterInfo();
            }
        });
    });
}

// 获取角色信息
function requestCharacterInfo() {
    getCharacterInfo(
        userStore.userInfo.character_being_used,
        (err, response) => {
            if (err) {
                // 处理错误
                ElMessage.error(err.message);
                window.collectEvent(
                    "im_message_request_character_info_failed",
                    {
                        error: err,
                    }
                );
            } else {
                // 处理成功的响应
                userStore.characterInfo = response.payload.character_detail;
                protraitImg.value =
                    userStore.characterInfo?.chat_background_image;
                // userStore.characterInfo.profile_photo =
                //response?.payload?.character_detail?.profile_photo;
                console.log(
                    "userStore.characterInfo====",
                    userStore.characterInfo
                );
                window.collectEvent(
                    "im_message_request_character_info_successed",
                    {}
                );
            }
        }
    );
}

async function setupImSdk() {
    imSdk = new ImSdk(
        Number(userStore.header["IM_APPID"]),
        userStore.userInfo.web_user_id,
        userStore.userInfo.character_being_used,
        userStore.header["device-identifier"],
        allMessages,
        getIMToken
    );
    console.log("imSdk===", imSdk);
    await imSdk.init();
    imSdk.startReceiveMessages(
        (message) => {
            // ...处理接收到的消息...
            if (imSdk.isLoadMore(message) || imSdk.isInit(message)) return;
            imSdk.storeMessages(message);
            setupMessages();
            if (!message.isFromMe) {
                console.log("%c消息更新 MessageUpsert", "color:red", message);
                isReceiving.value = false;
                topicState(message);
                if (message.messageType !== 1) {
                    // 剔除主动推荐消息
                    // 消息接收任务上报
                    reportReceiveServerMessage(message);
                    // 埋点
                    window.collectEvent('im_message_receive', {
                        clientMessageId: message.clientId,
                        message_id: message.serverId,
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
    provicyMessages = allMessages.slice(); 
    setupMessages();
    setTimeout(() => {
        scrollToBottom(); 
    }, 100);
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
        topicState(lastMessage);
    }else {
        getRecommendTopicList(false); // 没有聊天记录也请求话题推荐
    }
}

function setupMessages() {
    console.log("setupMessages", "messages===",messages,"provicyMessages===",provicyMessages,"allMessages===",allMessages);
    // 清空 messages 数组
    messages.splice(0, messages.length);
    if (privateModeSwitchOn.value === true) {
        // 如果 privateModeSwitchOn.value 为 true，筛选出 allMessages 中不在 provicyMessages 中的消息
        // 过滤后的消息推送回原始 messages 数组
        allMessages.forEach(function(message) {
            if (!provicyMessages.includes(message)) {
                messages.push(message);
            }
        });
        console.log("setupMessages", messages,'privateModeSwitchOn.value',privateModeSwitchOn.value);
    } else {
        // 添加新内容
        messages.push(...allMessages);
        console.log("setupMessages", messages,'privateModeSwitchOn.value',privateModeSwitchOn.value);
    }
}


// 数值体系: 上报用户接收消息行为
function reportReceiveServerMessage(message) {
    const reportItem = {
        action_type: "RECEIVE_SERVER_MESSAGE", // 具体类型从/api/users/get_action_config接口获取到的列表查看
        action_type_value: 9,
        character_id: userStore.userInfo.character_being_used,
        action_content: {
            server_message_id: message.clientId,
        },
        action_time: Math.floor(new Date().getTime() / 1000),
    };
    reportUserAction(reportItem, (err) => {
        if (err) {
            // 处理错误
            window.collectEvent(
                "im_message_report_receive_server_message_failed",
                {
                    message_id: message.serverId,
                    err: err,
                }
            );
        } else {
            // 处理成功的响应
            window.collectEvent(
                "im_message_report_receive_server_message_successed",
                {
                    message_id: message.serverId,
                }
            );
        }
    });
}

// 滚动到最下面的函数
function scrollToBottom() {
    nextTick(() => {
        console.log("scrollToBottom");
        if (chatHistory.value) {
            chatHistory.value.scrollTop = chatHistory.value.scrollHeight;
        }
    });
}

// 添加监听器
const messageListener = (arg) => {
    console.log("messageListener data.command", arg);
    dealMessage(arg);
};

// 处理客户端传来的消息
async function dealMessage(message) {
    let data = message.data;
    if (data.command) {
        console.log("messageListener data.command", data.command,"data",data);
        switch (data.command) {
            case "token_refresh":
                userStore.header = await getHeader();
                break;
            case "character_refresh":
                await initConversation(data.characterId);
                break;
            case "SetPrivacyPasswordSucceed":
                // 处理接收到的消息
                privateModeSwitchOn.value = false;
                isPrivacyDialogVisible.value = false;
                setupMessages();
                scrollToBottom();
            default:
                break;
        }
    }
}

function getNativePrivateConfig() {
    let callback = window.location.href;
    console.log("window.location.href==", callback);
    let privacyModeOpen = getQueryString(
        callback,
        "privacyModeOpen"
    );
    console.log("privacyModeOpen==", privacyModeOpen,"userStore.userInfo.private_mode_switch",userStore.userInfo.private_mode_switch);
    if(userStore.userInfo.private_mode_switch && privacyModeOpen == 'True') {
        // 设置私聊模式
        privateModeSwitchOn.value = true;
    }
}
onMounted(() => {
    window.collectEvent("im_message_load_complete", {
        time: new Date().getTime(),
    });
    window?.chrome?.webview?.addEventListener("message", messageListener, true);
    window.dealMessage = dealMessage;
});

onBeforeUnmount(() => {
    userStore.clearUserInfo();
    window.collectEvent("config", {
        user_unique_id: null,
        dev_env: null,
    });
    window?.chrome?.webview?.removeEventListener(
        "message",
        messageListener,
        true
    );
    imSdk?.disposeIMSdk();
});
</script>
  
<style scoped lang="scss">
.ai-chat {
    display: flex;
    flex-direction: column;
    position: absolute;
    opacity: 1;
    width: 100%;
    height: 100%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding-bottom: 18px;
    // background-color: $background-color;
    .chat-history {
        // background-color: $background-color;
        flex: 1;
        overflow-y: scroll;
        padding-bottom: 60px;
    }
    .chat-history::-webkit-scrollbar {
        width: 0;
        background: transparent;
        display: none;
    }

    .private-mode {
        height: 45px;
        width: 120px;
        margin: auto;
        color: $placeholder-color;
        text-align: center;
        font-size: $font-size-little;
        font-weight: $font-weight-bold;

        .private-tip {
            cursor: pointer;
        }
    }

    .ai-tip {
        margin-top: 12px;
        font-size: $font-size-little;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
        text-align: center;
        color: $placeholder-color;
    }
    .receiving {
        width: 52px;
        height: 44px;
        margin-left: 20px;
        padding: 20px 12px;
        border-radius: 4px 8px 8px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: $element-bg-color;
        span {
            display: inline-block;
            width: 4px;
            height: 4px;
            border-radius: 50%;
            margin-right: 4px;
            animation-name: loading-beat;
            /* 动画完成一个周期所需要的时间 */
            animation-duration: 1s;
            /* 定义动画从何时开始（延迟） */
            animation-delay: 0s;
            /* 动画播放次数（无限） */
            animation-iteration-count: infinite;
        }
        span:nth-child(1) {
            background: $receiving01-color;
        }
        span:nth-child(2) {
            animation-delay: 0.2s;
            background: $receiving01-color;
        }
        span:nth-child(3) {
            animation-delay: 0.4s;
            background: $receiving01-color;
        }
        span:nth-child(4) {
            animation-delay: 0.6s;
            background: $receiving01-color;
        }
        @keyframes loading-beat {
            0% {
                transform: translateX(0px) scale(1);
                background: $receiving04-color;
            }
            25% {
                transform: translateX(0px) scale(1.1);
            }
            50% {
                transform: translateX(0px) scale(1.1);
            }

            75% {
                transform: translateX(0px) scale(1.1);
            }
            100% {
                transform: translateX(0px) scale(1);
            }
        }
    }
    .edit-tip {
        margin-top: 6px;
        margin-bottom: 16px;
        margin-left: 20px;
        font-size: $font-size-little;
    }
    .edit-count-tip {
        color: $active-bg-color;
    }
}
.ai-chat::-webkit-scrollbar {
    width: 0;
    background: transparent;
    display: none;
}

.spinner {
    display: flex;
    margin: 0 auto;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

:deep(.el-dialog__headerbtn) {
    // top: 24px;
    right: 16px !important;
    width: 16px;
    height: 16px;
    background: url("@/assets/img/dislog_close@2x.png") left no-repeat;
    background-size: cover;

    &:hover {
        background: url("@/assets/img/dialog_close_hover@2x.png") left no-repeat;
        background-size: cover;
    }
    &:active {
        background: url("@/assets/img/dialog_close_active@2x.png") left
            no-repeat;
        background-size: cover;
    }
}
:deep(.el-dialog__headerbtn i) {
    content: "";
    font-size: $font-size-large;
    visibility: hidden;
}
:deep(.el-dialog--center .el-dialog__body) {
    padding: 25px calc(var(--el-dialog-padding-primary) + 5px) 0px;
}
.operate {
    position: absolute;
    bottom: 0;
    left: 0;
}

.allowUserSelect {
    user-select: none;
}
</style>
  