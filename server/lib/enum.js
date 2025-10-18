const ENUM_FUNDRAISING_EVENT_STATUS = {
    INACTIVE: 0, //關閉
    ACTIVE: 1, //啟動
    PAUSE: 2, //暫停
};
const ENUM_FUNDRAISING_EVENT_TYPE = {
    DOWN: 1, // 下降
    UP: 2, // 上升
    BLOOD_PRESSURE: 3, // 血壓
};

const ENUM_ICHIBAN_EVENT_STATUS = {
    ACTIVE: 1, // 進行中
    ENDED: 2, // 已結束
    PAUSED: 3, // 暫停
};

const ENUM_ICHIBAN_CARD_STATUS = {
    CLOSED: 0, // 卡片未開
    LOCKED: 1, // 卡片鎖定
    OPENED: 2, // 卡片開啟
};
module.exports = {
    ENUM_FUNDRAISING_EVENT_STATUS,
    ENUM_FUNDRAISING_EVENT_TYPE,
    ENUM_ICHIBAN_EVENT_STATUS,
    ENUM_ICHIBAN_CARD_STATUS,
};
