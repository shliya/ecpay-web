const express = require('express');
const router = new express.Router();
const { requireAdmin } = require('../../lib/admin-guard');
const handleListMerchantMembers = require('../../route-handlers/admin/handle-list-merchant-members');
const handleUnbindMerchant = require('../../route-handlers/admin/handle-unbind-merchant');
const handleBindMerchantToUser = require('../../route-handlers/admin/handle-bind-merchant-to-user');

// 整個 admin 區段都要求管理者身分，個別路由不必重複掛
router.use(requireAdmin);

router.get('/merchant-members', handleListMerchantMembers);
// 解綁後沒有 TOTP 的商店會變成沒人能登入的孤兒，這支是唯一的救援路徑
router.post('/merchant-members', handleBindMerchantToUser);
router.delete('/merchant-members/:merchantId', handleUnbindMerchant);

module.exports = router;
