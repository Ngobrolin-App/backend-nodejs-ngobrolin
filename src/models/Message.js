const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
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
    sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tbluser',
            key: 'id'
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    type: {
        type: DataTypes.STRING(20),
        defaultValue: 'text',
        validate: {
            isIn: [['text', 'image', 'file', 'audio', 'video']]
        }
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'tblmessages',
    timestamps: true,
    createdAt: 'created_at',
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
        }
    ]
});

module.exports = Message;