const crypto = require('crypto');

function decryptDataAndUrlDecode(encryptedData, hashKey, hashIV) {
    try {
        const buff = Buffer.from(encryptedData, 'base64');
        const decipher = crypto.createDecipheriv(
            'aes-128-cbc',
            hashKey,
            hashIV
        );
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(buff);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        const urlDecodedData = decodeURIComponent(
            decrypted.toString('utf8').replace(/\+/g, '%20')
        );
        const jsonData = JSON.parse(urlDecodedData);
        return jsonData;
    } catch (error) {
        console.error('解密錯誤：', error);
        return null;
    }
}

module.exports = {
    decryptDataAndUrlDecode,
};
