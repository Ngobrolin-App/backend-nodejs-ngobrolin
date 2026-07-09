const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const Conversation = require('./Conversation');
const ConversationParticipant = require('./ConversationParticipant');
const Message = require('./Message');
const BlockedUser = require('./BlockedUser');
const FCMToken = require('./FCMToken');

// Define associations
// User associations
User.hasMany(ConversationParticipant, { foreignKey: 'user_id', as: 'participations' });
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' });
User.hasMany(BlockedUser, { foreignKey: 'user_id', as: 'blockedUsers' });
User.hasMany(BlockedUser, { foreignKey: 'blocked_user_id', as: 'blockedBy' });
User.hasMany(FCMToken, { foreignKey: 'user_id', as: 'fcmTokens' });

// Conversation associations
Conversation.hasMany(ConversationParticipant, { foreignKey: 'conversation_id', as: 'participants' });
Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });
Conversation.belongsTo(User, { foreignKey: 'created_by_user_id', as: 'createdByUser' });

// ConversationParticipant associations
ConversationParticipant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ConversationParticipant.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
ConversationParticipant.belongsTo(Message, { foreignKey: 'last_read_message_id', as: 'lastReadMessage' });

// Message associations
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
Message.belongsTo(Message, { as: 'repliedMessage', foreignKey: 'replied_message_id' });
Message.belongsTo(Message, { as: 'forwardedFromMessage', foreignKey: 'forwarded_from_message_id' });

// BlockedUser associations
BlockedUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
BlockedUser.belongsTo(User, { foreignKey: 'blocked_user_id', as: 'blockedUser' });

// FCMToken associations
FCMToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Export all models
module.exports = {
    sequelize,
    User,
    Conversation,
    ConversationParticipant,
    Message,
    BlockedUser,
    FCMToken
};