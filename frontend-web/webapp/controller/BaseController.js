sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/Fragment",
    "sap/m/StandardListItem",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], function (Controller, UIComponent, Fragment, StandardListItem, Filter, FilterOperator, MessageBox) {
    "use strict";

    return Controller.extend("zpeweb.controller.BaseController", {

        getRouter() {
            return UIComponent.getRouterFor(this);
        },

        updateBreadcrumbs(sCurrentLocation, aHistory) {
            const oNavModel = this.getOwnerComponent().getModel("navModel");
            if (oNavModel) {
                oNavModel.setProperty("/currentLocation", sCurrentLocation);
                oNavModel.setProperty("/history", aHistory);
            }
        },

        onToggleTheme: function () {
            const oCore = sap.ui.getCore();
            const sCurrentTheme = oCore.getConfiguration().getTheme();

            const sNewTheme = sCurrentTheme.includes("dark") ? "sap_horizon" : "sap_horizon_dark";

            oCore.getConfiguration().setTheme(sNewTheme);
            localStorage.setItem("userTheme", sNewTheme);
        },

        applySavedTheme: function () {
            const sSavedTheme = localStorage.getItem("userTheme");
            if (sSavedTheme && sap.ui.getCore().getConfiguration().getTheme() !== sSavedTheme) {
                sap.ui.getCore().getConfiguration().setTheme(sSavedTheme);
            }
        },

        onGlobalNavBack(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("navModel");
            const sRoute = oContext.getProperty("route");

            this.getRouter().navTo(sRoute);
        },

        onNavBack() {
            window.history.go(-1);
        },

        _getText(sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        onInputLiveChange(oEvent) {
            const oInput = oEvent.getSource();
            const sValue = oEvent.getParameter("value");
            const sOnlyNumbers = sValue.replace(/\D/g, "");

            if (sValue !== sOnlyNumbers) {
                oInput.setValue(sOnlyNumbers);
            }
        },

        async onValueHelpMaterial(oEvent, sEntitySet) {
            const oView = this.getView();
            const oInput = oEvent.getSource();
            this._oInputOrigem = oInput;
            
            const sPath = oInput.data("entitySet") || "/ZshPeProdutoAcabadoSet";

            if (!this._pDialogMaterial) {
                this._pDialogMaterial = Fragment.load({
                    id: oView.getId(),
                    name: "zpeweb.view.fragments.ValueHelpMaterial",
                    controller: this
                }).then((oDialog) => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            const oDialog = await this._pDialogMaterial;

            const oI18nModel = oView.getModel("i18n") || this.getOwnerComponent().getModel("i18n");
            const oResourceBundle = oI18nModel.getResourceBundle();

            // valida se é mp
            const sPathLower = sPath.toLowerCase();
            const bIsMP = sPathLower.includes("materiaprima") || sPathLower.includes("mp");

            // define titulo
            const sTitleKey = bIsMP ? "inputMP" : "inputPA";
            oDialog.setTitle(oResourceBundle.getText(sTitleKey));

            oDialog.bindAggregation("items", {
                path: sPath,
                parameters: { operationMode: "Client" },
                template: new StandardListItem({
                    title: "{Codigocm}",
                    description: "{Descricaocm}"
                })
            });

            oDialog.getBinding("items").filter([]);
            oDialog.open();
        },

        onValueHelpSearch(oEvent) {
            const sRawValue = oEvent.getParameter("value") || "";
            const sValue = sRawValue.trim().toUpperCase();

            const oBinding = oEvent.getSource().getBinding("items");
            if (!oBinding) {
                return;
            }

            if (!sValue) {
                oBinding.filter([]);
                return;
            }

            const aFilters = [
                new Filter({
                    filters: [
                        new Filter({ path: "Codigocm", operator: FilterOperator.Contains, value1: sValue, caseSensitive: false }),
                        new Filter({ path: "Descricaocm", operator: FilterOperator.Contains, value1: sValue, caseSensitive: false })
                    ],
                    and: false
                })
            ];

            oBinding.filter(aFilters);
        },

        onValueHelpClose(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                const sSelectedCode = oSelectedItem.getTitle();

                // Input que disparou o Search Help
                let oInput = this._oInputOrigem;

                // Falback de segurança
                if (!oInput) {
                    oInput = this.byId("iptCodigoPA") ||
                        this.byId("iptCodigoMP") ||
                        this.byId("inputProdutoAcabado") ||
                        this.byId("inputMaterial");
                }

                if (oInput) {
                    // Remove zeros à esquerda para evitar conflitos com HTML
                    const sCleanValue = oInput.getType() === "Number" ? sSelectedCode.replace(/^0+/, "") : sSelectedCode;

                    oInput.setValue(sCleanValue);
                    oInput.fireChange({ value: sCleanValue });

                    // Identifica se a seleção veio de um campo de PA
                    const sInputId = oInput.getId();
                    const bIsPA = sInputId.includes("CodigoPA") ||
                        sInputId.includes("ProdutoAcabado") ||
                        sInputId.includes("InputMaterial") ||
                        sInputId.includes("inputMaterial");

                    // Executa se a busca for PA e se o método for onBuscar
                    if (bIsPA && typeof this.onBuscar === "function") {
                        this.onBuscar();
                    }
                }
            }

            // Limpa os filtros de busca do Dialog
            const oBinding = oEvent.getSource().getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }

            // Reseta a referência na memória
            this._oInputOrigem = null;
        },

        _readCollection(sPath, aFilters) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();
                if (!oModel) {
                    reject(new Error(this._getText("errorODataModelNotFound")));
                    return;
                }
                oModel.read(sPath, {
                    filters: aFilters || [],
                    success: (oData) => resolve(Array.isArray(oData && oData.results) ? oData.results : []),
                    error: (oError) => reject(oError)
                });
            });
        },

        _extrairDetalhesErro(oError) {
            let sMensagem = "";
            let aDetails = [];

            try {
                const oResponseBody = JSON.parse(oError.responseText);
                aDetails = oResponseBody?.error?.innererror?.errordetails || [];
                sMensagem = oResponseBody?.error?.message?.value || "";

                if (!sMensagem && aDetails.length > 0) {
                    const oDetailValido = aDetails.find(d => d.message && d.code !== "/IWBEP/CX_MGW_BUSI_EXCEPTION");
                    sMensagem = oDetailValido ? oDetailValido.message : aDetails[0].message;
                }
            } catch (e) {
                sMensagem = (oError && oError.message) ? oError.message : "";
            }

            return { sMensagem: sMensagem, aDetails: aDetails };
        },

        _tratarErro(oError, sMensagemPadrao) {
            const oErroInfo = this._extrairDetalhesErro(oError);
            const sErrorDetails = oErroInfo.sMensagem || sMensagemPadrao;
            MessageBox.error(sErrorDetails);
        }
    });
});