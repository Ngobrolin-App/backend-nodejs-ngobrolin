const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BlockedUser = sequelize.define('BlockedUser', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tbluser',
            key: 'id'
        }
    },
    blockedUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tbluser',
            key: 'id'
        }
    }
}, {
    tableName: 'tblblocked_users',
    updatedAt: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            unique: true,
            fields: ['user_id', 'blocked_user_id']
        }
    ]
});

module.exports = BlockedUser;