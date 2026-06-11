const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conversation = sequelize.define('Conversation', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    type: {
        type: DataTypes.ENUM('private', 'group'),
        defaultValue: 'private',
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        validate: {
            len: [1, 100]
        }
    },
    groupImage: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            isUrl: true
        }
    }
}, {
    tableName: 'tblconversations',
    updatedAt: false
});

module.exports = Conversation;