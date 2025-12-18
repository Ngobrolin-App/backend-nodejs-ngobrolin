'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    /* =========================
       ENUMS
    ========================== */
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_tblconversations_type AS ENUM ('private', 'group');
    `);

    /* =========================
       tbluser
    ========================== */
    await queryInterface.createTable('tbluser', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      bio: {
        type: DataTypes.TEXT
      },
      avatar_url: {
        type: DataTypes.TEXT
      },
      language: {
        type: DataTypes.STRING(5),
        defaultValue: 'id'
      },
      is_private: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    /* =========================
       tblconversations
    ========================== */
    await queryInterface.createTable('tblconversations', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true
      },
      type: {
        type: 'enum_tblconversations_type',
        allowNull: false,
        defaultValue: 'private'
      },
      name: {
        type: DataTypes.STRING(100)
      },
      group_image: {
        type: DataTypes.TEXT
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    /* =========================
       tblmessages
    ========================== */
    await queryInterface.createTable('tblmessages', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true
      },
      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tblconversations',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tbluser',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      type: {
        type: DataTypes.STRING(20),
        defaultValue: 'text'
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    /* =========================
       tblconversation_participants
    ========================== */
    await queryInterface.createTable('tblconversation_participants', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true
      },
      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tblconversations',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tbluser',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      last_read_message_id: {
        type: DataTypes.UUID,
        references: {
          model: 'tblmessages',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      joined_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    /* =========================
       tblblocked_users
    ========================== */
    await queryInterface.createTable('tblblocked_users', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tbluser',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      blocked_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tbluser',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    /* =========================
       tblfcm_tokens
    ========================== */
    await queryInterface.createTable('tblfcm_tokens', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tbluser',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    /* =========================
       INDEXES
    ========================== */
    await queryInterface.addIndex('tblblocked_users', ['user_id']);
    await queryInterface.addIndex('tblblocked_users', ['user_id', 'blocked_user_id'], { unique: true });

    await queryInterface.addIndex('tblfcm_tokens', ['user_id']);
    await queryInterface.addIndex('tblfcm_tokens', ['token'], { unique: true });

    await queryInterface.addIndex('tblmessages', ['conversation_id']);
    await queryInterface.addIndex('tblmessages', ['sender_id']);
    await queryInterface.addIndex('tblmessages', ['created_at']);

    await queryInterface.addIndex('tblconversation_participants', ['conversation_id']);
    await queryInterface.addIndex('tblconversation_participants', ['user_id']);
    await queryInterface.addIndex(
      'tblconversation_participants',
      ['conversation_id', 'user_id'],
      { unique: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tblfcm_tokens');
    await queryInterface.dropTable('tblblocked_users');
    await queryInterface.dropTable('tblconversation_participants');
    await queryInterface.dropTable('tblmessages');
    await queryInterface.dropTable('tblconversations');
    await queryInterface.dropTable('tbluser');

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_tblconversations_type;
    `);
  }
};
