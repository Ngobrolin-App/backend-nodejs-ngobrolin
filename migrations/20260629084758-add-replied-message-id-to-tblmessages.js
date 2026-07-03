'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tblmessages', 'replied_message_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'tblmessages',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addIndex('tblmessages', ['replied_message_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('tblmessages', ['replied_message_id']);
    await queryInterface.removeColumn('tblmessages', 'replied_message_id');
  }
};
