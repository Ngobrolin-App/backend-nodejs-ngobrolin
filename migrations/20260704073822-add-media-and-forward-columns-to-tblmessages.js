'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Tambah kolom Media
    await queryInterface.addColumn('tblmessages', 'media_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('tblmessages', 'media_file_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('tblmessages', 'media_size', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 2. Tambah kolom Forwarding
    await queryInterface.addColumn('tblmessages', 'forwarded_from_message_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'tblmessages',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
    await queryInterface.addColumn('tblmessages', 'is_forwarded', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('tblmessages', 'forwarded_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    // 3. Tambah Index untuk performa
    await queryInterface.addIndex('tblmessages', ['forwarded_from_message_id']);
  },

  async down(queryInterface, Sequelize) {
    // Hapus Index
    await queryInterface.removeIndex('tblmessages', ['forwarded_from_message_id']);

    // Hapus Kolom
    await queryInterface.removeColumn('tblmessages', 'forwarded_count');
    await queryInterface.removeColumn('tblmessages', 'is_forwarded');
    await queryInterface.removeColumn('tblmessages', 'forwarded_from_message_id');
    await queryInterface.removeColumn('tblmessages', 'media_size');
    await queryInterface.removeColumn('tblmessages', 'media_file_type');
    await queryInterface.removeColumn('tblmessages', 'media_url');
  }
};