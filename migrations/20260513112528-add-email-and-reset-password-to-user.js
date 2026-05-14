'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tbluser', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    });

    await queryInterface.addColumn('tbluser', 'reset_password_token', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('tbluser', 'reset_password_expires', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tbluser', 'email');
    await queryInterface.removeColumn('tbluser', 'reset_password_token');
    await queryInterface.removeColumn('tbluser', 'reset_password_expires');
  }
};
