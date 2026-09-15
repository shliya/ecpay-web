const express = require('express');
const router = new express.Router();
const loginRateLimiter = require('../../middleware/rate-limit-login');
const handleGetMe = require('../../route-handlers/me/handle-get-me');
const handleBindMerchant = require('../../route-handlers/me/handle-bind-merchant');
const handleCreateMerchant = require('../../route-handlers/me/handle-create-merchant');

router.get('/', handleGetMe);
router.post('/bind-merchant', loginRateLimiter, handleBindMerchant);
// 建立新商店：只要 Google 登入，金流金鑰稍後在設定頁填
router.post('/merchants', loginRateLimiter, handleCreateMerchant);

module.exports = router;
