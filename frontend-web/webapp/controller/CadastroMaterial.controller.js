sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], function (BaseController, Controller, History, JSONModel, MessageToast, MessageBox, Fragment) {
    "use strict";

    return BaseController.extend("zpeweb.controller.CadastroMaterial", {

        onInit: function () {
            const oMaterialModel = new JSONModel({
                Codigocm: "",
                Descricaocm: "",
                UnidadeMedidacm: "",
                Tipocm: "1",
                isEdit: false
            });
            this.getView().setModel(oMaterialModel, "material");
            this.applySavedTheme();
        },

        _getI18nText: function (sKey) {
            const oResourceModel = this.getView().getModel("i18n");
            return oResourceModel ? oResourceModel.getResourceBundle().getText(sKey) : sKey;
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
            this._clearForm();
            this._showDialog();
        },

        _showDialog: function () {
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

            this._pDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCancel: function () {
            if (this._pDialog) {
                this._pDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },

        // --- PREPARAR EDIÇÃO ---
        onEdit: function (oEvent) {
            const oItemContext = oEvent.getSource().getBindingContext();
            const oData = oItemContext.getObject();

            const oModel = this.getView().getModel("material");
            oModel.setData({
                Codigocm: oData.Codigocm,
                Descricaocm: oData.Descricaocm,
                UnidadeMedidacm: oData.UnidadeMedidacm,
                Tipocm: oData.Tipocm,
                isEdit: true
            });

            this._showDialog();
        },

        // --- EXCLUSÃO (DELETE) ---
        onDelete: function (oEvent) {
            const oItemContext = oEvent.getSource().getBindingContext();
            const sCodigo = oItemContext.getProperty("Codigocm");
            const oODataModel = this.getView().getModel();

            MessageBox.confirm(
                this._getI18nText("msgConfirmDelete") || `Deseja realmente excluir o material ${sCodigo}?`,
                {
                    title: this._getI18nText("titleConfirmDelete") || "Confirmar Exclusão",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            // Gera o path exato: /ZTPE_MATERIALSet(Codigocm='0056')
                            const sPath = oODataModel.createKey("/ZTPE_MATERIALSet", { Codigocm: sCodigo });

                            oODataModel.remove(sPath, {
                                success: function () {
                                    MessageToast.show(this._getI18nText("msgMaterialDeletedSuccess") || "Material excluído com sucesso!");
                                }.bind(this),
                                error: function (oError) {
                                    this._handleODataError(oError, "msgMaterialDeleteError");
                                }.bind(this)
                            });
                        }
                    }.bind(this)
                }
            );
        },

        // --- SALVAR (CREATE OU UPDATE) ---
        onSave: function () {
            const oModel = this.getView().getModel("material");
            const oData = oModel.getData();

            if (!oData.Descricaocm || !oData.UnidadeMedidacm || !oData.Tipocm) {
                MessageBox.error(this._getI18nText("msgFillRequired"));
                return;
            }

            if (oData.isEdit) {
                this._updateMaterial(oData);
            } else {
                this._createMaterial(oData);
            }
        },

        _createMaterial: function (oData) {
            const oODataModel = this.getView().getModel();
            const oPayload = {
                Descricaocm: oData.Descricaocm,
                UnidadeMedidacm: oData.UnidadeMedidacm,
                Tipocm: oData.Tipocm
            };

            oODataModel.create("/ZTPE_MATERIALSet", oPayload, {
                success: function () {
                    MessageToast.show(this._getI18nText("msgMaterialCreatedSuccess"));
                    this.onCancel();
                }.bind(this),
                error: function (oError) {
                    this._handleODataError(oError, "msgMaterialCreateError");
                }.bind(this)
            });
        },

        _updateMaterial: function (oData) {
            MessageBox.confirm(
                this._getI18nText("msgConfirmUpdate") || `Deseja realmente salvar as alterações do material ${oData.Codigocm}?`,
                {
                    title: this._getI18nText("titleConfirmUpdate") || "Confirmar Alteração",
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) {
                            return;
                        }

                        const oODataModel = this.getView().getModel();
                        const sPath = oODataModel.createKey("/ZTPE_MATERIALSet", { Codigocm: oData.Codigocm });

                        const oPayload = {
                            Codigocm: oData.Codigocm,
                            Descricaocm: oData.Descricaocm,
                            UnidadeMedidacm: oData.UnidadeMedidacm,
                            Tipocm: oData.Tipocm
                        };

                        oODataModel.update(sPath, oPayload, {
                            success: function () {
                                MessageToast.show(this._getI18nText("msgMaterialUpdatedSuccess") || "Material atualizado com sucesso!");
                                this.onCancel();
                            }.bind(this),
                            error: function (oError) {
                                this._handleODataError(oError, "msgMaterialUpdateError");
                            }.bind(this)
                        });
                    }.bind(this)
                }
            );
        },

        _handleODataError: function (oError, sDefaultKey) {
            let sMessage = this._getI18nText(sDefaultKey);
            try {
                const oErrorResponse = JSON.parse(oError.responseText);
                sMessage = oErrorResponse.error.message.value;
            } catch (e) {}
            MessageBox.error(sMessage);
        },

        _clearForm: function () {
            const oModel = this.getView().getModel("material");
            oModel.setData({
                Codigocm: "",
                Descricaocm: "",
                UnidadeMedidacm: "",
                Tipocm: "1",
                isEdit: false
            });
        }
    });
});