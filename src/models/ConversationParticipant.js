const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ConversationParticipant = sequelize.define('ConversationParticipant', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tblconversations',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tbluser',
            key: 'id'
        }
    },
    last_read_message_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'tblmessages',
            key: 'id'
        }
    }
}, {
    tableName: 'tblconversation_participants',
    createdAt: 'joined_at',
    updatedAt: false,
    indexes: [
        {
            fields: ['conversation_id']
        },
        {
            fields: ['user_id']
        },
        {
            unique: true,
            fields: ['conversation_id', 'user_id']
        }
    ]
});

module.exports = ConversationParticipant;