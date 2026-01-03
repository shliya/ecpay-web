export default class ActiveStatusKeeper {
    constructor(merchantId, port = 3001) {
        this.merchantId = merchantId;

        const isProduction = window.location.protocol === 'https:';
        const wsProtocol = isProduction ? 'wss:' : 'ws:';
        const wsHost = isProduction
            ? window.location.host
            : `localhost:${port}`;
        this.url = `${wsProtocol}//${wsHost}?merchantId=${merchantId}`;

        this.ws = null;
        this.pingInterval = null;
        this.reconnectTimeout = null;
    }

    connect() {
        if (!this.merchantId) {
            console.warn('ActiveStatusKeeper: 無 MerchantId，無法啟動');
            return;
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log(`[ActiveKeeper] 連線成功: ${this.merchantId}`);
            this.startHeartbeat();
        };

        this.ws.onclose = () => {
            console.log('[ActiveKeeper] 連線中斷，嘗試重新連線...');
            this.stopHeartbeat();
            // 斷線後 3 秒重連
            this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = error => {
            console.error('[ActiveKeeper] 連線錯誤:', error);
            this.ws.close();
        };
    }

    startHeartbeat() {
        // 每 60 秒發送一次 Ping
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(
                    JSON.stringify({
                        type: 'ping',
                        merchantId: this.merchantId,
                    })
                );
            }
        }, 60000);
    }

    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // 頁面關閉時呼叫此方法
    disconnect() {
        this.stopHeartbeat();
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        if (this.ws) this.ws.close();
    }
}
