const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tblconversations',
            key: 'id'
        }
    },
    senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tbluser',
            key: 'id'
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    type: {
        type: DataTypes.STRING(20),
        defaultValue: 'text',
        validate: {
            isIn: [['text', 'image', 'file', 'audio', 'video']]
        }
    },
    isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    repliedMessageId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'tblmessages',
            key: 'id'
        }
    },
    mediaUrl: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mediaFileType: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    mediaSize: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    forwardedFromMessageId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'tblmessages',
            key: 'id'
        }
    },
    isForwarded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    forwardedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    mediaFileName: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'tblmessages',
    updatedAt: false,
    indexes: [
        {
            fields: ['conversation_id']
        },
        {
            fields: ['sender_id']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['forwarded_from_message_id']
        },
    ]
});

module.exports = Message;