sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
], (Controller, UIComponent, JSONModel, MessageToast, MessageBox) => {
    "use strict";

    return Controller.extend("zpeweb.controller.CadastroBom", {
        onInit: function () {
            var oViewModel = new JSONModel({
                bMostrarCadastroBom: false,
                tituloProduto: ""
            });
            this.getView().setModel(oViewModel, "viewModel");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteCockpit");
        },

        onBuscarProduto: function () {
            var sCodigoPA = this.byId("iptCodigoPA").getValue();
            var oViewModel = this.getView().getModel("viewModel");

            if (!sCodigoPA) {
                MessageBox.error("Digite um código de produto acabado para buscar.");
                return;
            }

            var bProdutoEncontrado = true; // Simulação de busca no backend

            if (bProdutoEncontrado) {
                oViewModel.setProperty("/tituloProduto", "BOM do Produto: " + sCodigoPA + " - PORTA MÉDIA");
                oViewModel.setProperty("/bMostrarCadastroBom", true);
                
                MessageToast.show("Produto encontrado com sucesso!");
            } else {
                MessageBox.error("Produto não encontrado.");
            }
        }
    });
});