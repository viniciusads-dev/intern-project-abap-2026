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
            var oModel = this.getView().getModel();
            var oViewModel = this.getView().getModel("viewModel");

            if (!sCodigoPA) {
                MessageBox.error("Digite um código de produto acabado para buscar.");
                return;
            }

            oModel.read("/ZTPE_BOMSet", {
                filters: [
                    new sap.ui.model.Filter("Codigopa", sap.ui.model.FilterOperator.EQ, sCodigoPA)
                ],
                success: function (oDataBOM) {

                    oModel.read("/ZTPE_MATERIALSet", {
                        success: function (oDataMateriais) {

                            var mMateriais = {};
                            oDataMateriais.results.forEach(function (mat) {
                                var sCodigo = mat.Codigocm;
                                var sDescricao = mat.Descricaocm;

                                if (sCodigo) {
                                    var sCodClean = String(sCodigo || "").trim().replace(/^0+/, '');
                                    mMateriais[sCodClean] = sDescricao;
                                }
                            });

                            var aItensCompletos = oDataBOM.results.map(function (itemBOM) {
                                var sPaClean = String(itemBOM.Codigopa || "").replace(/^0+/, '').trim();
                                var sMpClean = String(itemBOM.Codigomp || "").replace(/^0+/, '').trim();

                                return {
                                    Codigopa: itemBOM.Codigopa,
                                    Descricaopa: mMateriais[sPaClean] || "Não encontrado",
                                    Codigomp: itemBOM.Codigomp,
                                    Descricaomp: mMateriais[sMpClean] || "Não encontrado",
                                    Quantidademp: itemBOM.Quantidademp
                                };
                            });

                            oViewModel.setProperty("/itensBOM", aItensCompletos);
                            oViewModel.setProperty("/bMostrarCadastroBom", true);
                        },
                        error: function () {
                            sap.m.MessageToast.show("Erro ao carregar a tabela");
                        }
                    });

                },
                erro: function () {
                    sap.m.MessageToast.show("Erro ao buscar a estrutura BOM.");
                }
            });
        }
    });
});