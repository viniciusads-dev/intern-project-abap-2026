sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "zpeweb/util/reportGenerator" // <-- 1. Importamos o cérebro exportador aqui!
], function (BaseController, Controller, History, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, Fragment, ReportGenerator) {
    "use strict";

    return BaseController.extend("zpeweb.controller.Reports", {

        onInit: function () {
            const oViewModel = new JSONModel({
                reportType: "MOV",
                filterMaterial: "",
                filterMovType: "",
                filterDateFrom: null,
                filterDateTo: null,
                filterPedido: "",
                filterDateFromPed: null,
                filterDateToPed: null
            });
            this.getView().setModel(oViewModel, "view");
            this.applySavedTheme();
        },

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

        onChangeReport: function () {
            this.onClear();
        },

        onClear: function () {
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/filterMaterial", "");
            oViewModel.setProperty("/filterMovType", "");
            oViewModel.setProperty("/filterDateFrom", null);
            oViewModel.setProperty("/filterDateTo", null);
            oViewModel.setProperty("/filterPedido", "");
            oViewModel.setProperty("/filterDateFromPed", null);
            oViewModel.setProperty("/filterDateToPed", null);

            this.getView().byId("tblMovimentos").getBinding("items").filter([]);
            this.getView().byId("tblPedidos").getBinding("items").filter([]);
        },

        onSearch: function () {
            const oViewModel = this.getView().getModel("view");
            const sReportType = oViewModel.getProperty("/reportType");
            const aFilters = [];

            if (sReportType === "MOV") {
                const sMaterial = oViewModel.getProperty("/filterMaterial");
                const sMovType = oViewModel.getProperty("/filterMovType");
                const oDateFrom = oViewModel.getProperty("/filterDateFrom");
                const oDateTo = oViewModel.getProperty("/filterDateTo");

                if (oDateFrom && oDateTo && oDateFrom > oDateTo) {
                    MessageBox.warning("A data inicial não pode ser maior que a data final.");
                    return;
                }

                if (sMaterial) aFilters.push(new Filter("Codigom", FilterOperator.EQ, sMaterial.toUpperCase()));
                if (sMovType) aFilters.push(new Filter("Tipol", FilterOperator.EQ, sMovType));
                
                if (oDateFrom && oDateTo) {
                    const dStart = new Date(oDateFrom); dStart.setHours(0, 0, 0, 0);
                    const dEnd = new Date(oDateTo); dEnd.setHours(23, 59, 59, 999);
                    aFilters.push(new Filter("Datal", FilterOperator.BT, dStart, dEnd));
                } else if (oDateFrom) {
                    const dStart = new Date(oDateFrom); dStart.setHours(0, 0, 0, 0);
                    aFilters.push(new Filter("Datal", FilterOperator.GE, dStart));
                } else if (oDateTo) {
                    const dEnd = new Date(oDateTo); dEnd.setHours(23, 59, 59, 999);
                    aFilters.push(new Filter("Datal", FilterOperator.LE, dEnd));
                }
                
                this.getView().byId("tblMovimentos").getBinding("items").filter(aFilters);

            } else if (sReportType === "PED") {
                let sPedido = oViewModel.getProperty("/filterPedido");
                const oDateFromPed = oViewModel.getProperty("/filterDateFromPed");
                const oDateToPed = oViewModel.getProperty("/filterDateToPed");
                
                // ESPIÃO DE TELA: Mostra no console do navegador o que o Fiori leu
                console.log("--- BUSCA DE PEDIDOS ---");
                console.log("Pedido digitado:", sPedido);
                console.log("Data Inicio:", oDateFromPed);
                console.log("Data Fim:", oDateToPed);

                if (oDateFromPed && oDateToPed && oDateFromPed > oDateToPed) {
                    MessageBox.warning("A data inicial não pode ser maior que a data final.");
                    return;
                }

                // CORREÇÃO: Adiciona zeros à esquerda para o SAP entender (ex: "24" vira "0024")
                if (sPedido) {
                    sPedido = String(sPedido).padStart(4, "0");
                    aFilters.push(new Filter("Numeropedido", FilterOperator.EQ, sPedido));
                }
                
                if (oDateFromPed && oDateToPed) {
                    const dStartPed = new Date(oDateFromPed); dStartPed.setHours(0, 0, 0, 0);
                    const dEndPed = new Date(oDateToPed); dEndPed.setHours(23, 59, 59, 999);
                    aFilters.push(new Filter("Datap", FilterOperator.BT, dStartPed, dEndPed));
                } else if (oDateFromPed) {
                    const dStartPed = new Date(oDateFromPed); dStartPed.setHours(0, 0, 0, 0);
                    aFilters.push(new Filter("Datap", FilterOperator.GE, dStartPed));
                } else if (oDateToPed) {
                    const dEndPed = new Date(oDateToPed); dEndPed.setHours(23, 59, 59, 999);
                    aFilters.push(new Filter("Datap", FilterOperator.LE, dEndPed));
                }
                
                console.log("Filtros OData montados:", aFilters);
                this.getView().byId("tblPedidos").getBinding("items").filter(aFilters);
            }
        },

        onExport: function(oEvent) {
            const oMenuItem = oEvent.getParameter("item");
            const sFormat = oMenuItem.getKey(); 
            const oViewModel = this.getView().getModel("view");
            const sReportType = oViewModel.getProperty("/reportType");
            
            const mExport = {
                format: sFormat,
                reportType: sReportType 
            };

            if (sReportType === "MOV") {
                mExport.Codigom = oViewModel.getProperty("/filterMaterial");
                mExport.Tipol = oViewModel.getProperty("/filterMovType");
                mExport.dateFrom = oViewModel.getProperty("/filterDateFrom");
                mExport.dateTo = oViewModel.getProperty("/filterDateTo");
            } else {
                let sPedido = oViewModel.getProperty("/filterPedido");
                
                // CORREÇÃO: Coloca os zeros à esquerda na exportação também
                if (sPedido) {
                    sPedido = String(sPedido).padStart(4, "0");
                }
                
                mExport.Numeropedido = sPedido;
                mExport.dateFrom = oViewModel.getProperty("/filterDateFromPed");
                mExport.dateTo = oViewModel.getProperty("/filterDateToPed");
            }

            // ESPIÃO DE EXPORTAÇÃO
            console.log("--- DADOS ENVIADOS PARA O REPORT GENERATOR ---");
            console.log(mExport);

            this.getView().setBusy(true);

            ReportGenerator.executeExport(this.getView().getModel(), mExport)
                .then((sResultFormat) => {
                    MessageToast.show(`Relatório ${sResultFormat} gerado com sucesso!`);
                })
                .catch((oError) => {
                    MessageBox.error(oError.message || "Não foi possível gerar o relatório.");
                })
                .finally(() => {
                    this.getView().setBusy(false);
                });
        },

        // Lógicas de Pedido (Value Help)
        onValueHelpPedido: function () {
            const oView = this.getView();
            if (!this._pPedidoDialog) {
                this._pPedidoDialog = Fragment.load({
                    id: oView.getId(),
                    name: "zpeweb.view.fragments.PedidoHelpDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pPedidoDialog.then(function(oDialog) {
                oDialog.getBinding("items").filter([]);
                oDialog.open();
            });
        },

        onPedidoHelpSearch: function (oEvent) {
            const sValue = oEvent.getParameter("value");
            const oFilter = new Filter("Numeropedido", FilterOperator.Contains, sValue);
            oEvent.getParameter("itemsBinding").filter([oFilter]);
        },

        onPedidoHelpConfirm: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                const sPedido = oSelectedItem.getTitle();
                this.getView().getModel("view").setProperty("/filterPedido", sPedido);
                this.onSearch();
            }
        },

        onPedidoPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const sPedido = oContext.getProperty("Numeropedido");
            
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RoutePedidoDetail", {
                pedidoId: sPedido
            });
        }
    });
});