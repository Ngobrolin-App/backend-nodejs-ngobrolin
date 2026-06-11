const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FCMToken = sequelize.define('FCMToken', {
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
    token: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true
        }
    }
}, {
    tableName: 'tblfcm_tokens',
    updatedAt: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            unique: true,
            fields: ['token']
        }
    ]
});

module.exports = FCMToken;