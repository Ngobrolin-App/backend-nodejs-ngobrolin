'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Modifikasi tabel tblmessages
      await queryInterface.addColumn('tblmessages', 'is_unsent', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('tblmessages', 'is_edited', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('tblmessages', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: true // Dibiarkan true agar data lama tidak error
      }, { transaction });

      // 2. Modifikasi tabel tblconversations
      await queryInterface.addColumn('tblconversations', 'group_description', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('tblconversations', 'created_by_user_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'tbluser',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });

      await queryInterface.addColumn('tblconversations', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: true
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('tblmessages', 'is_unsent', { transaction });
      await queryInterface.removeColumn('tblmessages', 'is_edited', { transaction });
      await queryInterface.removeColumn('tblmessages', 'updated_at', { transaction });

      await queryInterface.removeColumn('tblconversations', 'group_description', { transaction });
      await queryInterface.removeColumn('tblconversations', 'created_by_user_id', { transaction });
      await queryInterface.removeColumn('tblconversations', 'updated_at', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
