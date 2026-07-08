'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Tambah kolom system_event_type (VARCHAR(50))
    await queryInterface.addColumn('tblmessages', 'system_event_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    // 2. Tambah kolom system_metadata (JSONB untuk performa query data dinamis)
    await queryInterface.addColumn('tblmessages', 'system_metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Hapus kolom dengan urutan terbalik demi keamanan arsitektur
    await queryInterface.removeColumn('tblmessages', 'system_metadata');
    await queryInterface.removeColumn('tblmessages', 'system_event_type');
  }
};