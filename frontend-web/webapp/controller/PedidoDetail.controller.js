sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "zpeweb/util/reportGenerator"
], function (Controller, History, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, ReportGenerator) {
    "use strict";

    return Controller.extend("zpeweb.controller.PedidoDetail", {

        onInit: function () {
            const oViewModel = new JSONModel({
                pedidoId: "",
                pedidoDateText: "",
                tableItems: []
            });
            this.getView().setModel(oViewModel, "view");

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RoutePedidoDetail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: async function (oEvent) {
            const sPedidoId = oEvent.getParameter("arguments").pedidoId;
            const oViewModel = this.getView().getModel("view");
            
            oViewModel.setProperty("/pedidoId", sPedidoId);
            oViewModel.setProperty("/tableItems", []); 

            this.getView().setBusy(true);

            try {
                const oModel = this.getView().getModel();
                
                const oHeader = await this._readODataSingle(oModel, `/ZTPE_PED_CABSet('${sPedidoId}')`);
                
                let sDateText = "";
                if (oHeader && oHeader.Datap) {
                    const oDate = new Date(oHeader.Datap);
                    const day = String(oDate.getDate()).padStart(2, "0");
                    const month = String(oDate.getMonth() + 1).padStart(2, "0");
                    const year = oDate.getFullYear();
                    sDateText = `${day}.${month}.${year}`;
                    oViewModel.setProperty("/pedidoDateText", sDateText);
                }

                const aFilters = [new Filter("Numeropedido", FilterOperator.EQ, sPedidoId)];
                const aItems = await this._readODataList(oModel, "/ZTPE_PED_ITEMSet", aFilters);

                // 3. Busca a lista de Materiais (Para pegar a descrição)
                const aMaterials = await this._readODataList(oModel, "/ZTPE_MATERIALSet");
                const mMaterials = aMaterials.reduce((acc, m) => {
                    acc[m.Codigocm] = m.Descricaocm;
                    return acc;
                }, {});

                const aTableItems = aItems.map(it => {
                    return {
                        pedido: it.Numeropedido,
                        dateText: sDateText,
                        material: it.Codigomp,
                        description: mMaterials[it.Codigomp] || "",
                        quantity: String(it.Quantidademp || "0").replace(/^0+/, "") || "0"
                    };
                });

                oViewModel.setProperty("/tableItems", aTableItems);

            } catch (error) {
                MessageBox.error("Erro ao carregar os dados do pedido. Verifique a conexão.");
            } finally {
                this.getView().setBusy(false);
            }
        },

        _readODataSingle: function (oModel, sPath) {
            return new Promise((resolve, reject) => {
                oModel.read(sPath, {
                    success: (oData) => resolve(oData),
                    error: (oError) => reject(oError)
                });
            });
        },

        _readODataList: function (oModel, sPath, aFilters = []) {
            return new Promise((resolve, reject) => {
                oModel.read(sPath, {
                    filters: aFilters,
                    success: (oData) => resolve(Array.isArray(oData && oData.results) ? oData.results : []),
                    error: (oError) => reject(oError)
                });
            });
        },

        onExport: function(oEvent) {
            const oMenuItem = oEvent.getParameter("item");
            const sFormat = oMenuItem.getKey(); 
            const sPedidoId = this.getView().getModel("view").getProperty("/pedidoId");
            
            const mExport = {
                format: sFormat,
                reportType: "PED",
                Numeropedido: sPedidoId,
                dateFrom: null,
                dateTo: null
            };

            this.getView().setBusy(true);

            // Chamamos o Cérebro Utilitário
            ReportGenerator.executeExport(this.getView().getModel(), mExport)
                .then((sResultFormat) => {
                    MessageToast.show(`Relatório ${sResultFormat} do pedido ${sPedidoId} gerado com sucesso!`);
                })
                .catch((oError) => {
                    MessageBox.error(oError.message || "Não foi possível gerar o relatório.");
                })
                .finally(() => {
                    this.getView().setBusy(false);
                });
        },

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteReports", {}, true);
            }
        }
    });
});