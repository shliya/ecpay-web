const { createEcpayConfig } = require('../../service/ecpay-config');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getAuthSession } = require('../../lib/auth-session');
const {
    bindMerchant,
    recordBindAudit,
    getMembershipsByUserId,
} = require('../../store/merchant-member');

/** 商店代號的格式限制，對齊 ecpay_config.merchantId 的欄位長度 */
const MERCHANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
const MAX_DISPLAY_NAME = 100;

/**
 * 建立新商店（僅需 Google 登入）。
 *
 * 刻意不要求金流金鑰：申請綠界／PayUni／歐富寶的商店代號與 Hash Key
 * 是使用者在各金流後台自行處理的事，不該卡在建立帳號這一步。
 * 建立完成後導去設定頁，由既有的
 * PATCH /api/v1/comme/ecpay/config/id=:merchantId 分別填入各家金鑰。
 *
 * 建立與綁定是連動的：建立者立刻成為擁有者，
 * 所以新商店不需要、也不會有 TOTP。
 */
module.exports = async (req, res) => {
    const ipAddress = req.ip || null;
    const userAgent = req.headers['user-agent'] || null;

    try {
        const session = await getAuthSession(req);
        if (!session) {
            res.status(401).json({ error: '請先使用 Google 登入' });
            return;
        }
        const userId = session.user.id;

        const merchantId = String(req.body?.merchantId || '').trim();
        const displayName = String(req.body?.displayName || '').trim();

        if (!merchantId) {
            res.status(400).json({ error: '請輸入商店代號' });
            return;
        }
        if (!MERCHANT_ID_PATTERN.test(merchantId)) {
            res.status(400).json({
                error: '商店代號僅能包含英文、數字、底線與減號，且長度不超過 50',
            });
            return;
        }
        if (displayName.length > MAX_DISPLAY_NAME) {
            res.status(400).json({ error: '顯示名稱過長' });
            return;
        }

        // 單店限制（方案 A3）：schema 支援多店，現階段先擋住
        const existingMemberships = await getMembershipsByUserId(userId);
        if (existingMemberships.length > 0) {
            res.status(409).json({
                error: `此 Google 帳號已綁定商店 ${existingMemberships[0].merchantId}`,
            });
            return;
        }

        const duplicated = await getEcpayConfigByMerchantId(merchantId);
        if (duplicated) {
            res.status(409).json({ error: '這個商店代號已經被使用' });
            return;
        }

        const row = { merchantId };
        // displayName 在資料表有唯一約束，空字串會互相衝突，一律不寫入
        if (displayName) {
            row.displayName = displayName;
        }

        let created;
        try {
            created = await createEcpayConfig(row);
        } catch (error) {
            if (/已存在/.test(error.message || '')) {
                res.status(409).json({
                    error: '商店代號或顯示名稱已經被使用',
                });
                return;
            }
            throw error;
        }

        const bound = await bindMerchant({
            userId,
            merchantId,
            boundVia: 'created',
        });

        await recordBindAudit({
            userId,
            merchantId,
            action: 'bind',
            method: 'created',
            result: bound.ok ? 'success' : 'failed',
            reason: bound.ok ? 'created_with_merchant' : bound.code,
            ipAddress,
            userAgent,
        });

        if (!bound.ok) {
            console.error(
                `[me] 商店 ${merchantId} 已建立但綁定失敗: ${bound.code}`
            );
            res.status(409).json({
                error: '商店已建立，但綁定失敗，請重新登入後再試',
                merchantId,
                bound: false,
            });
            return;
        }

        res.status(201).json({
            success: true,
            merchantId,
            displayName: displayName || null,
            id: created.id,
            bound: true,
            // 下一步：到設定頁填綠界／PayUni／歐富寶的 Hash Key 與 IV
            nextUrl: `settings.html?merchantId=${encodeURIComponent(merchantId)}`,
        });
    } catch (error) {
        console.error('[me] 建立商店失敗:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
