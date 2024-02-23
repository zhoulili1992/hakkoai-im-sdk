import Dayjs from 'dayjs'

const zhTime = {
    year: "年",
    month: "月",
    day: "日",
    monday: "星期一",
    tuesday: "星期二",
    wednesday: "星期三",
    thursday: "星期四",
    friday: "星期五",
    saturday: "星期六",
    sunday: "星期日",
    yesterday: "昨天"
}

const enTime = {
    year: "Year",
    month: "Month",
    day: "Day",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
    yesterday: "Yesterday"
}

const jaTime = {
    year: "年",
    month: "月",
    day: "日",
    monday: "月曜日",
    tuesday: "火曜日",
    wednesday: "水曜日",
    thursday: "木曜日",
    friday: "金曜日",
    saturday: "土曜日",
    sunday: "日曜日",
    yesterday: "昨日"
}


// 判断当前日期是否处在本周内
function sameWeek(past) {
    const pastTime = new Date(past).getTime()
    const today = new Date(new Date().toLocaleDateString())
    let day = today.getDay()
    day = day == 0 ? 7 : day
    const oneDayTime = 60 * 60 * 24 * 1000
    const monday = new Date(today.getTime() - (oneDayTime * (day - 1)))
    const nextMonday = new Date(today.getTime() + (oneDayTime * (8 - day)))
    if (monday.getTime() <= pastTime && nextMonday.getTime() > pastTime) {
        return true
    } else {
        return false
    }
}
// 时分秒个位数的拼接0
function covertSingleDigit(num) {
    return num >= 10 ? num : `0${num}`
}

// 时间戳转格式化时间，time：时间戳，format：转换的时间格式字符串
function formatTimestamp(time, format) {
    return Dayjs(time).format(format)
}

/**
 * 
 * @param value - 格式化时间 
 * 返回数据规则:  当天显示:HH:MM 
 *              昨天展示:昨天 HH:MM
 *              一周内展示:周几 HH:MM
 *              本年度内展示:xx月xx日 HH:MM
 *              跨年展示:xx年xx月xx日 HH:MM
 */
function dateFormat(value,language) {
    // value = value * 1000
    const dayDiff = Dayjs(Dayjs(value).format('YYYY/MM/D')).diff(
        Dayjs(Dayjs().format('YYYY/MM/D')),
        'day'
    );

    let time = zhTime;
    if(language === "en") {
        time = enTime;
    }else if(language === "ja") {
        time = jaTime;
    }

    let date = new Date(value);
    let y = date.getFullYear();
    let MM = date.getMonth() + 1;
    let d = date.getDate();

    let curdate = new Date();
    let cy = curdate.getFullYear();

    var now = curdate.getTime();

    // var diffValue = now - value;

    var minute = 1000 * 60;
    var hour = minute * 60;
    var day = hour * 24;
    // var week = day * 7;

    let temp = '';
    if (cy > y) {
        // 01/23/2023（2023年1月23日）
        temp = d + '/' + MM + '/' + y + '/';
        return temp + ' ' + covertSingleDigit(date.getHours()) + ':' + covertSingleDigit(date.getMinutes());
    } else if (!sameWeek(value)) {
        // */*(前面是月，后面是日）
        temp = MM + '/' + d;
        return temp + ' ' + covertSingleDigit(date.getHours()) + ':' + covertSingleDigit(date.getMinutes());
    } else if (dayDiff < -1 && sameWeek(value)) {
        let weekArr = [time.sunday,time.monday,time.tuesday,time.wednesday,time.thursday,time.friday,time.saturday];
        return weekArr[new Date(value).getDay()] + ' ' + covertSingleDigit(date.getHours()) + ':' + covertSingleDigit(date.getMinutes());
    } else if (dayDiff == -1) {
        return time.yesterday + ' ' + covertSingleDigit(date.getHours()) + ':' + covertSingleDigit(date.getMinutes());
    } else {
        return covertSingleDigit(date.getHours()) + ':' + covertSingleDigit(date.getMinutes());
    }

}
  
export {
    dateFormat,
    formatTimestamp,
}