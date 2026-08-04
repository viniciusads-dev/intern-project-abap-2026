sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], function (Controller, History, JSONModel, MessageToast, MessageBox, Fragment) {
    "use strict";

    return Controller.extend("zpeweb.controller.CadastroMaterial", {

        onInit: function () {
            const oMaterialModel = new JSONModel({
                Descricaocm: "",
                UnidadeMedidacm: "",
                Tipocm: "1" 
            });
            this.getView().setModel(oMaterialModel, "material");
        },

        // Função utilitária para pegar os textos do i18n no JS
        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteCockpit", {}, true);
            }
        },

        onOpenDialog: function () {
            const oView = this.getView();

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "zpeweb.view.fragments.CadastroMaterialDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function(oDialog) {
                this._clearForm();
                oDialog.open();
            }.bind(this));
        },

        onCancel: function () {
            if (this._pDialog) {
                this._pDialog.then(function(oDialog) {
                    oDialog.close();
                });
            }
        },

        onSave: function () {
            const oModel = this.getView().getModel("material");
            const oData = oModel.getData();

            // Usa o texto traduzido para a validação
            if (!oData.Descricaocm || !oData.UnidadeMedidacm || !oData.Tipocm) {
                MessageBox.error(this._getI18nText("msgFillRequired"));
                return;
            }

            const oODataModel = this.getView().getModel();

            oODataModel.create("/ZTPE_MATERIALSet", oData, {
                success: function (oResponse) {
                    MessageToast.show(this._getI18nText("msgMaterialCreatedSuccess"));
                    this.onCancel();
                }.bind(this),
                error: function (oError) {
                    let sMessage = this._getI18nText("msgMaterialCreateError");
                    try {
                        const oErrorResponse = JSON.parse(oError.responseText);
                        sMessage = oErrorResponse.error.message.value;
                    } catch (e) {}
                    MessageBox.error(sMessage);
                }.bind(this) // Importante amarrar o .bind(this) no erro também para acessar o _getI18nText
            });
        },

        _clearForm: function () {
            const oModel = this.getView().getModel("material");
            oModel.setData({
                Descricaocm: "",
                UnidadeMedidacm: "",
                Tipocm: "1"
            });
        }
    });
});