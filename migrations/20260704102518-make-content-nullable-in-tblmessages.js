'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tblmessages', 'content', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tblmessages', 'content', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  }
};