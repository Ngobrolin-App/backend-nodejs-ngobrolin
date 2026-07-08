'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tblmessages', 'is_forwarded');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('tblmessages', 'is_forwarded', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }
};
