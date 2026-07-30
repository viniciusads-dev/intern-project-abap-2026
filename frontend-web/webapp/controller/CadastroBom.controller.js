sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, UIComponent, JSONModel, MessageToast, MessageBox, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("zpeweb.controller.CadastroBom", {
        onInit: function () {
            var oViewModel = new JSONModel({
                bMostrarCadastroBom: false,
                tituloProduto: "",
                itensBOM: []
            });
            this.getView().setModel(oViewModel, "viewModel");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteCockpit");
        },
        
        // Tratador de erros do OData (Lê o Message do SEGW)
        _tratarErro: function (oError) {
            var sMensagem = "Erro ao solicitar serviço no servidor";

            try {
                var oResponseBody = JSON.parse(oError.responseText);
                var aDetalhes = oResponseBody.error?.innererror?.errordetails;

                if (aDetalhes && aDetalhes.length > 0) {
                    var oDetail = aDetalhes.find(function (item) { 
                        return item.message && item.message !== ""; 
                    });

                    if (oDetail) {
                        sMensagem = oDetail.message;
                    }
                }

                if (sMensagem === "Erro ao processar a solicitação no servidor." && 
                  oResponseBody.erro?.message?.value) {
                    sMensagem = oResponseBody.error.message.value;
                }

            } catch (e) {
                if (oError.message) {
                    sMensagem = oError.message;
                }
            }
            MessageBox.error(sMensagem);
        },

        // Método para adicionar zeros à esquerda, ex: "0000"
        _padZero: function (sValue, iCodlength) {
            if (!sValue) {
                return "";
            }

            var iCodLength = iCodlength || 4;
            var sClean = String(sValue).trim();

            while (sClean.length < iCodlength) {
                sClean = "0" + sClean;
            }
            return sClean;
        },

        // Método para filtrar o PA digitado no início
        _filtrarPorPA: function (sCodigoPA) {
            var oTable = this.byId("tableBomItems");
            var oBinding = oTable.getBinding("items");

            if (oBinding && sCodigoPA) {
                var oFiltro = new Filter(
                    "Codigopa", FilterOperator.EQ, sCodigoPA
                );
            
                oBinding.filter([oFiltro]);
            }
        },

        // Busca a lista BOM do PA digitado
        onBuscarProduto: function () {
            var sCodigoPA = this.byId("iptCodigoPA").getValue();
            var oModel = this.getView().getModel();
            var oViewModel = this.getView().getModel("viewModel");

            if (!sCodigoPA) {
                MessageBox.error("Digite um código de produto acabado para buscar.");
                return;
            }

            this._filtrarPorPA(sCodigoPA);

            // Tratando o código com zeros à esqueda
            sCodigoPA = this._padZero(sCodigoPA, 4);
            
            this.getView().setBusy(true);

            oModel.read("/ZTPE_BOMSet", {
                filters: [
                    new Filter("Codigopa", FilterOperator.EQ, sCodigoPA)
                ],
                success: function (oDataBOM) {
                    this.getView().setBusy(false);

                    if (!oDataBOM.results || oDataBOM.results.length === 0) {
                        MessageToast.show("Nenhuma estrutura encontrada para o código informado")
                        oViewModel.setProperty("/itensBOM", []);
                        oViewModel.setProperty("/bMostrarCadastroBom", false);
                        return;
                    }

                    oViewModel.setProperty("/itensBOM", oDataBOM.results);
                    oViewModel.setProperty("/bMostrarCadastroBom", true);

                    
                    var oPrimeiroItem = oDataBOM.results[0];
                    var sCodPA = this._padZero(oPrimeiroItem.Codigopa, 4);
                    var sDescPA = oPrimeiroItem.Descricaopa || "";

                    oViewModel.setProperty("/tituloProduto", sCodPA + " - " + sDescPA);

                }.bind(this),

                erro: function (oError) {
                    this.getView().setBusy(false);
                    this._tratarErro(oError);
                }.bind(this)
            });
        },

        // Create BOM
        onAdicionarMp: function () {
            var oModel = this.getView().getModel();

            var sCodPA = this.byId("iptCodigoPA").getValue();
            var sCodMP = this.byId("iptMateriaPrima").getValue();
            var sQtdMP = this.byId("iptQuantidade").getValue(); 
            
            if (!sCodMP || !sQtdMP) {
                MessageBox.warning("Preencha todos os campos.");
                return;
            }

            var fQtd = parseFloat(sQtdMP.replace(",", "."));
            if(isNaN(fQtd) || fQtd <= 0) {
                MessageBox.warning("Quantidade dever ser maior que Zero.")
                return;
            }

            // Formantando inputs recebidos (ex: '0001')
            sCodPA = this._padZero(sCodPA, 4);
            sCodMP = this._padZero(sCodMP, 4);
            sQtdMP = this._padZero(sQtdMP, 4);

            var oPayLoad = {
                Codigopa: sCodPA,
                Codigomp: sCodMP,
                Quantidademp: sQtdMP
            };

            this.getView().setBusy(true);

            oModel.create("/ZTPE_BOMSet", oPayLoad, {
                success: function (oData) {
                    this.getView().setBusy(false);
                    MessageToast.show("Material adicionado com sucesso.");

                    this.byId("iptMateriaPrima").setValue("");
                    this.byId("iptQuantidade").setValue("");

                    var oBinding = this.byId("tableBomItems").getBinding("items");
                    if(oBinding) {
                        oBinding.refresh();
                    }

                }.bind(this),
                error: function (oError) {
                    this.getView().setBusy(false);
                    this._tratarErro(oError);
                }.bind(this)
            });
        },

        onDeletarItem: function (oEvent) {
            var oModel = this.getView().getModel();

            // Recupera contexto OData da linha onde o botão foi clicado
            var oItemContext = oEvent.getSource().getBindingContext();
            var sPath = oItemContext.getPath();
            var oDadosLinha = oItemContext.getObject();

            MessageBox.confirm(
                "Deseja realmente remover a Matéria-Prima " + oDadosLinha.Codigomp + "?", 
                {
                    title: "Confirmar Exclusão",
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            this.getView().setBusy(true);

                            oModel.remove(sPath, {
                                success: function() {
                                    this.getView().setBusy(false);
                                    MessageToast.show("Item removido com sucesso.");

                                    var oBinding = this.byId("tableBomItems").getBinding("items");
                                    if (oBinding) {
                                        oBinding.refresh();
                                    }
                                }.bind(this),

                                error: function (oError) {
                                    this.getView().setBusy(false);
                                    this._tratarErro(oError);
                                }.bind(this)
                            });
                        }
                    }.bind(this)
                }
            );
        }

    });
});