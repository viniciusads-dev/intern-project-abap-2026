/*global QUnit*/

sap.ui.define([
	"zpeweb/controller/None.controller"
], function (Controller) {
	"use strict";

	QUnit.module("None Controller");

	QUnit.test("I should test the None controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
