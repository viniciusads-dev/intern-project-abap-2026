sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], (BaseController, Controller, UIComponent, MessageBox, JSONModel) => {
    "use strict";

    return BaseController.extend("zpeweb.controller.Cockpit", {
        onInit: function() {
            const oViewModel = new JSONModel({
                TotalEstoque: 0,
                paCount: 0,
                paItems: []
            });
            this.getView().setModel(oViewModel, "viewModel");
            
            this.getRouter().attachRouteMatched(this.onRouteMatched, this);
            this.applySavedTheme();

            const oEventBus = sap.ui.getCore().getEventBus();
            oEventBus.subscribe("Inventory", "StockChanged", this._onStockChangedEvent, this);
        },

        onRouteMatched: function(oEvent) {
            this._carregarTotalEstoque();
            this._carregarProdutosAcabados();
        },

        _carregarProdutosAcabados: function() {
            const oModel = this.getOwnerComponent().getModel();
            const oViewModel = this.getView().getModel("viewModel");

            if (!oModel) return;

            oModel.refresh();

            oModel.read("/ZSTR_ESTOQUE_ODATASet", {
                filters: [
                    new sap.ui.model.Filter("Tipocm", sap.ui.model.FilterOperator.EQ, "2")
                ],
                success: (oData) => {
                    if (oData && oData.results) {
                        
                        const aZerados = oData.results.filter(item => {
                            const sQtd = String(item.Quantidadem || "0").replace(",", ".");
                            const nQtd = parseFloat(sQtd);
                            return nQtd === 0;
                        });

                        oViewModel.setProperty("/paCount", aZerados.length);
                        oViewModel.setProperty("/paItems", aZerados);
                    }
                },
                error: (oError) => {
                    console.error("Erro ao carregar Produtos Acabados", oError);
                }
            });
        },

       _carregarTotalEstoque() {
            const oOwnerComponent = this.getOwnerComponent();
            const oModel = oOwnerComponent ? oOwnerComponent.getModel() : null;
            const oViewModel = this.getView().getModel("viewModel");

            if (!oModel || !oViewModel) {
                console.warn("Modelo OData padrão não encontrado no Component.");
                return;
            }

            oModel.metadataLoaded().then(() => {
                // 1. Carrega o Total de Estoque
                oModel.read("/ZSTR_ESTOQUE_ODATASet", {
                    success: (oData) => {
                        if (oData && oData.results) {
                            const iTotal = oData.results.length;
                            oViewModel.setProperty("/TotalEstoque", iTotal);
                        }
                    },
                    error: (oError) => {
                        console.error("Erro ao carregar Estoque", oError);
                        oViewModel.setProperty("/TotalEstoque", 0);
                    }
                });

                oModel.read("/ZSTR_ESTOQUE_ODATASet", {
                    filters: [
                        new sap.ui.model.Filter("Quantidadem", sap.ui.model.FilterOperator.EQ, "0"),
                        new sap.ui.model.Filter("Tipocm", sap.ui.model.FilterOperator.EQ, "2") 
                    ],
                    success: (oData) => {
                        if (oData && oData.results) {
                            oViewModel.setProperty("/criticalCount", oData.results.length);
                        }
                    },
                    error: (oError) => {
                        console.error("Erro ao checar estoque crítico", oError);
                    }
                });

            }).catch((oError) => {
                console.error("Erro ao carregar metadados do Estoque", oError);
            });
        },

        _onStockChangedEvent: function (sChannel, sEvent, oData) {
            this._carregarTotalEstoque();
            this._carregarProdutosAcabados();
        },

        onExit: function () {
            const oEventBus = sap.ui.getCore().getEventBus();
            oEventBus.unsubscribe("Inventory", "StockChanged", this._onStockChangedEvent, this);
        },

        onCriticalDataReceived: function (oEvent) {
            const oData = oEvent.getParameter("data");
            const iCount = oData && oData.results ? oData.results.length : 0;
            
            this.getView().getModel("viewModel").setProperty("/criticalCount", iCount);
        },

        onOpenNotifications: function (oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("notificationsPopover");
            setTimeout(() => {
                oPopover.openBy(oButton);
            }, 0);
        },

        onPAItemPress: function (oEvent) {
            const oListItem = oEvent.getSource();
            const oContext = oListItem.getBindingContext("viewModel");

            if (oContext) {
                const sMaterialCode = oContext.getProperty("Codigom");
                
                this.byId("notificationsPopover").close();
                
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteCentralCompras", {
                    materialPA: sMaterialCode
                });
            }
        },

        onCriticalItemPress: function (oEvent) {
            const oListItem = oEvent.getSource();
            const oContext = oListItem.getBindingContext("viewModel");

            if (oContext) {
                const sMaterialCode = oContext.getProperty("Codigom");
                
                this.byId("notificationsPopover").close();
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteCentralCompras", {
                    materialPA: sMaterialCode
                });
            }
        },

        /**
         * Trata o clique nos cards do cockpit
         * @param {sap.ui.base.Event} oEvent - Evento do clique
         */
        onCardPress(oEvent) {
            const oSource = oEvent.getSource();
            const sRoute = oSource.data("route");
            const mRouteMap = {
                inventory: "RouteInventory",
                executar: "RouteExecutarProducao",
                cadastrobom: "RouteCadastroBom",
                centralcompras: "RouteCentralCompras",
                unidademedida: "RouteUnidadeMedida",
                cadastroMaterial: "RouteCadastroMaterial",
                reports: "RouteReports",
                itemDetail: "RouteItemDetail"
            };
            const sRouteName = mRouteMap[sRoute];

            if (sRouteName) {
                this.getRouter().navTo(sRouteName);
            } else {
                MessageBox.information("Funcionalidade em desenvolvimento");
            }
        },

        /**
         * Retorna a instância do router
         * @returns {sap.m.routing.Router} - Instância do router
         */
        getRouter() {
            return UIComponent.getRouterFor(this);
        }
    });
});