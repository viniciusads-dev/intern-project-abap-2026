sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
<<<<<<< HEAD
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], (Controller, UIComponent, MessageBox, JSONModel) => {
=======
    "sap/m/MessageBox"
], (BaseController, Controller, UIComponent, MessageBox) => {
>>>>>>> dc95894cf2616d664b05c9c34c0026235f02cb98
    "use strict";

    return BaseController.extend("zpeweb.controller.Cockpit", {
        onInit() {
            const oViewModel = new JSONModel({
                TotalEstoque: 0
            });
            this.getView().setModel(oViewModel, "viewModel");
            this.getRouter().attachRouteMatched(this.onRouteMatched, this);
            this.applySavedTheme();
        },

        onRouteMatched(oEvent) {
            // Lógica executada quando a rota do cockpit é correspondida
            // Pode ser usada para buscar dados iniciais ou atualizar o estado
            this._carregarTotalEstoque();
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
            }).catch((oError) => {
                console.error("Erro ao carregar metadados do Estoque", oError);
            })
        }
    });
});
