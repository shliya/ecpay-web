# 資料庫 Migration（Umzug）

本專案使用 [Umzug](https://github.com/sequelize/umzug) 管理 schema 變更，執行紀錄存在 **`schema_migrations`** 表。

## 目錄結構

| 路徑 | 說明 |
|------|------|
| `server/migration/migrate.js` | CLI 入口 |
| `server/migration/umzug/*.js` | **新** migration（依檔名前綴排序） |
| `server/migration/create-umzug.js` | Umzug 設定 |
| `server/migration/legacy-migration-names.js` | 導入 Umzug 前已手動跑過的舊檔名 |
| `server/migration/bootstrap-legacy-records.js` | 一次性登記舊 migration 紀錄 |
| `server/migration/*.js`（根目錄） | **舊版**手動 migration（已跑過的勿刪，新功能請改寫到 `umzug/`） |

## 連線環境

| `NODE_ENV` | 使用的 DB |
|------------|-----------|
| `production` | `DATABASE_URL` |
| 其他（如 `local`） | `TEST_DB_URL` |

---

## 日常指令

```powershell
# 執行待跑的 migration
npm run migrate

# 查看已執行 / 待執行
npm run migrate:status

# 僅列待執行
npm run migrate:pending
```

等同於：

```powershell
node server/migration/migrate.js up
node server/migration/migrate.js status
```

---

## 本地開發

```powershell
cd D:\ecpay\ecpay-web

# 1. 確認連本地 DB（.env NODE_ENV=local、TEST_DB_URL）
npm run migrate:status

# 2. 執行
npm run migrate
```

---

## 正式站（Render / Supabase）

**順序：先 migration，再 deploy 新程式。**

```powershell
$env:NODE_ENV="production"
$env:DATABASE_URL="你的正式 DATABASE_URL"

# 可選：先看狀態
node server/migration/migrate.js status

# 執行
npm run migrate
```

或在 Render Shell（環境變數已設好）：

```bash
NODE_ENV=production node server/migration/migrate.js up
```

---

## 第一次導入 Umzug（正式站 schema 已是最新）

若正式站之前是手動 `node server/migration/xxx.js`，schema 已完整但 **`schema_migrations` 是空的**：

```powershell
# 1. 預覽將登記哪些舊 migration（不寫入）
node server/migration/bootstrap-legacy-records.js --dry-run

# 2. 寫入紀錄（不執行 SQL）
npm run migrate:bootstrap-legacy

# 3. 再跑 Umzug，只會執行 umzug/ 裡尚未登記的（例如 001-addStatus...）
npm run migrate:status
npm run migrate
```

> `legacy-migration-names.js` **不含** `addStatusToPaymentPendingOrders`（這次新功能，由 Umzug 001 負責）。

---

## 002：TOTP 密文改 PBKDF2（`002-reencrypt-totp-secrets-pbkdf2`）

將 `ecpay_config.totpSecret` 從「SHA256(ENCRYPTION_KEY)」改為「PBKDF2 + ENCRYPTION_KEY_SALT」重加密。

**使用者不需重綁 TOTP**（明文 secret 不變）。

執行前請在環境變數加入（之後不可更換 salt）：

```powershell
# 產生 salt（一次，正式／本地各自存進 env）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
ENCRYPTION_KEY=<原本的，不要改>
ENCRYPTION_KEY_SALT=<上面產生的 hex>
```

然後：

```powershell
npm run migrate
```

應用程式仍可解密舊格式（無 `v2:` 前綴）；migration 跑完後密文皆為 `v2:`。

---

## 新增 migration

1. 在 `server/migration/umzug/` 新增檔案，檔名用排序前綴：

   ```
   002-yourMigrationName.js
   ```

2. 匯出 `up` / `down`：

   ```javascript
   /** @param {{ context: import('sequelize').Sequelize }} params */
   async function up({ context: sequelize }) {
       await sequelize.query(`ALTER TABLE ...`);
   }

   async function down({ context: sequelize }) {
       await sequelize.query(`ALTER TABLE ...`);
   }

   module.exports = { up, down };
   ```

3. 本地驗證：

   ```powershell
   npm run migrate:status
   npm run migrate
   ```

4. 正式站 deploy 前：`NODE_ENV=production npm run migrate`

**請勿**把新 Umzug 檔名加進 `legacy-migration-names.js`。

---

## 檢查 schema（唯讀）

```powershell
$env:DATABASE_URL="..."
node server/migration/_inspect-schema-readonly.js
```

---

## 注意

- 不要用 `npm run sync` 取代正式站 migration。
- `down` 請謹慎在正式站使用（目前 CLI 未暴露 `down`，需自行擴充）。
- 舊檔 `node server/migration/addStatusToPaymentPendingOrders.js` 仍可用，但會顯示 deprecated 並轉呼叫 Umzug。
