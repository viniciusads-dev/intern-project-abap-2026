sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/ui/core/routing/History",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "zpeweb/util/reportGenerator"
], function (BaseController, History, Filter, FilterOperator, JSONModel, MessageToast, MessageBox, ReportGenerator) {
    "use strict";

    return BaseController.extend("zpeweb.controller.ItemDetail", {

        onInit: function () {
            const oViewModel = new JSONModel({
                materialCode: "",
                metrics: { totalIn: 0, totalOut: 0, outPercentage: 0 }
            });
            this.getView().setModel(oViewModel, "view");

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteItemDetail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            const sMaterialCode = oEvent.getParameter("arguments").materialCode;
            const oModel = this.getView().getModel();
            
            this.getView().getModel("view").setProperty("/materialCode", sMaterialCode);

            const sObjectPath = oModel.createKey("/ZSTR_ESTOQUE_ODATASet", {
                Codigom: sMaterialCode
            });
            
            this.getView().bindElement({
                path: sObjectPath,
                events: {
                    dataRequested: () => this.getView().setBusy(true),
                    dataReceived: () => this.getView().setBusy(false)
                }
            });

            const aFilters = [new Filter("Codigom", FilterOperator.EQ, sMaterialCode)];
            const oTableBinding = this.getView().byId("tblLogs").getBinding("items");
            oTableBinding.filter(aFilters);

            // MÁGICA: Assim que a tabela receber os dados do SAP, nós calculamos os gráficos
            oTableBinding.attachEventOnce("dataReceived", (oEventData) => {
                const aContexts = oEventData.getSource().getContexts(0, 1000); 
                let totalIn = 0, totalOut = 0;
                
                aContexts.forEach(oCtx => {
                    const sType = oCtx.getProperty("Tipol");
                    const nQty = parseFloat(oCtx.getProperty("Quantidadel")) || 0;
                    
                    if (sType === "E") totalIn += nQty;
                    if (sType === "S") totalOut += nQty;
                });

                // Calcula a porcentagem (se entrou 100 e saiu 50, o giro é 50%)
                const totalMov = totalIn + totalOut;
                const outPerc = totalMov > 0 ? Math.round((totalOut / totalMov) * 100) : 0;

                const oView = this.getView().getModel("view");
                oView.setProperty("/metrics/totalIn", totalIn);
                oView.setProperty("/metrics/totalOut", totalOut);
                oView.setProperty("/metrics/outPercentage", outPerc);
            });
        },

        // ==========================================
        // EXPORTAÇÃO
        // ==========================================
        onExport: function(oEvent) {
            const oMenuItem = oEvent.getParameter("item");
            const sFormat = oMenuItem.getKey(); 
            
            const sMaterialCode = this.getView().getModel("view").getProperty("/materialCode");

            const mExport = {
                format: sFormat,
                reportType: "MOV",
                Codigom: sMaterialCode,
                Tipol: "",
                dateFrom: null,
                dateTo: null
            };

            this.getView().setBusy(true);

            ReportGenerator.executeExport(this.getView().getModel(), mExport)
                .then((sResultFormat) => {
                    MessageToast.show(`Relatório ${sResultFormat} do material gerado com sucesso!`);
                })
                .catch((oError) => {
                    MessageBox.error(oError.message || "Não foi possível gerar o relatório.");
                })
                .finally(() => {
                    this.getView().setBusy(false);
                });
        },

        // ==========================================
        // FORMATADORES
        // ==========================================
        formatMaterialType: function(vType) {
            const sType = String(vType || "").trim();
            if (sType === "1" || sType.toUpperCase() === "MATERIA_PRIMA") return "1 - Matéria Prima";
            if (sType === "2" || sType.toUpperCase() === "PRODUTO_ACABADO") return "2 - Produto Acabado";
            return sType;
        },

        formatMovementType: function (vType) {
            const sType = String(vType || "").trim().toUpperCase();
            if (sType === "E") return "E - Entrada";
            if (sType === "S") return "S - Saída";
            if (sType === "I") return "I - Inventário";
            return sType;
        },

        formatQuantity: function (sValue) {
            if (!sValue) return "0";
            return String(sValue).replace(/^0+/, "") || "0";
        },

        // ==========================================
        // NAVEGAÇÃO
        // ==========================================
        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteInventory", {}, true);
            }
        }
    });
});