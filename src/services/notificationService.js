const { FCMToken } = require('../models');
const { Op } = require('sequelize');
const { admin } = require('../config/firebase');
const { buildAvatarUrl } = require('../utils/urlHelper');

class NotificationService {
    /**
     * Send push notification for new message
     */
    static async sendNewMessageNotification(participants, senderId, messageRaw, conversationId, baseUrl) {
        try {
            const recipientIds = participants.map(p => p.userId).filter(id => id !== senderId);
            if (recipientIds.length === 0) return;

            const tokens = await FCMToken.findAll({
                where: { userId: { [Op.in]: recipientIds } },
                attributes: ['token']
            });

            const tokenList = tokens.map(t => t.token);
            if (tokenList.length === 0) return;

            const notifBody = messageRaw.type === 'text' ? messageRaw.content : 'Sent an attachment';
            const validTokens = tokenList.filter(t => typeof t === 'string' && t.length > 0);

            if (validTokens.length === 0) return;

            const result = await admin.messaging().sendEachForMulticast({
                tokens: validTokens,
                notification: {
                    title: messageRaw.sender.name || messageRaw.sender.username || 'New message',
                    body: notifBody
                },
                data: {
                    userId: String(messageRaw.senderId || ''),
                    name: String((messageRaw.sender.name || messageRaw.sender.username || '')),
                    avatarUrl: String(buildAvatarUrl(messageRaw.sender.avatarUrl, baseUrl) || ''),
                    conversationId: String(conversationId || '')
                }
            });

            // Cleanup invalid tokens
            const invalidIndexes = result.responses
                .map((r, idx) => ({ r, idx }))
                .filter(x => !x.r.success && x.r.error && x.r.error.code === 'messaging/registration-token-not-registered')
                .map(x => x.idx);

            if (invalidIndexes.length > 0) {
                const toDelete = invalidIndexes.map(i => validTokens[i]);
                await FCMToken.destroy({ where: { token: { [Op.in]: toDelete } } });
            }
        } catch (error) {
            console.error('FCM send error:', error);
            // Don't throw, just log. Notification failure shouldn't fail the request
        }
    }

    /**
     * Register FCM token
     */
    static async registerToken(userId, token) {
        const existing = await FCMToken.findOne({ where: { token } });

        if (existing) {
            if (existing.userId !== userId) {
                await existing.update({ userId: userId });
            }
            return { message: 'FCM token updated' };
        } else {
            await FCMToken.create({ userId: userId, token });
            return { message: 'FCM token registered' };
        }
    }

    /**
     * Delete FCM token
     */
    static async deleteToken(userId, token) {
        await FCMToken.destroy({
            where: {
                token,
                userId: userId
            }
        });
        return { message: 'FCM token deleted' };
    }
}

module.exports = NotificationService;