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
        _tratarErro: function () {
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

        // Busca a lista BOM existente para o PA informado
        onBuscarProduto: function () {
            var sCodigoPA = this.byId("iptCodigoPA").getValue();
            var oModel = this.getView().getModel();
            var oViewModel = this.getView().getModel("viewModel");

            if (!sCodigoPA) {
                MessageBox.error("Digite um código de produto acabado para buscar.");
                return;
            }

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

        onAdicionarMp: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var aItensAtuais = oViewModel.getProperty("/itensBOM") || [];

            var sCodPA = this.byId("iptCodigoPA").getValue();
            var sCodMP = this.byId("iptMateriaPrima").getValue();
            var sQtdMP = this.byId("iptQuantidade").getValue(); 
            
            if (!sCodMP) {
                MessageBox.warning("Informe o Código da Matéria-Prima ");
                return;
            }

            if(!sQtdMP || parseFloat(sQtdMP) <= 0) {
                MessageBox.warning("Quantidade tem que ser maior que 0 (Zero)")
                return;
            }

            // If temporario
            if(sQtdMP > 0 && sCodMP !== "") {
                MessageBox.success("Em desenvolvimento");
                return;
            }

            sCodPA = this._padZero(sCodPA, 4);
            sCodMP = this._padZero(sCodMP, 4);

            var bMPexiste = aItensAtuais.some( function (oItem) {
                return oItem.Codigopa === sCodPA && oItem.Codigomp === sCodMP;
            });
            if (bMPexiste) {
                MessageBox.error("Esta Matéria-Prima já foi adicionada");
                return;
            }

            this._validarEBuscarMP(sCodPA, sCodMP, sQtdMP);
        },

        //     sCodPA = this._padZero(sCodPA, 4);
        //     sCodMP = this._padZero(sCodMP, 4);
        //     sQtdMP = this._padZero(sQtdMP, 4);

        //     var sDescPA = aItensAtuais.length > 0 ? aItensAtuais[0].Descricaopa : "";

        //     this.getView().setBusy(true);

        //     var sPathMaterial = oModel.createKey("/ZTPE_MATERIALSet", {
        //         Codigocm: sCodMP
        //     });

        //     oModel.read(sPathMaterial, {
        //         success: function (oDataMaterial) {
        //             this.getView().setBusy(false);

        //             var sDescMP = oDataMaterial ? oDataMaterial.Descricaocm : "Descrição não encontrada";

        //             aItensAtuais.push({
        //                 Codigopa: sCodPA,
        //                 Descricaopa: sDescPA,
        //                 Codigomp: sCodMP,
        //                 Descricaomp: sDescMP,
        //                 Quantidademp: sQtdMP,
        //                 isNovo: true
        //             });

        //             oViewModel.setProperty("/itensBOM", aItensAtuais);

        //             this.byId("iptMateriaPrima").setValue("");
        //             this.byId("iptQuantidade").setValue("");

        //             MessageToast.show("Itens adicionado à lista total.")
        //         }.bind(this),
        //         error: function () {
        //             this.getView().setBusy(false);

        //             this.byId("iptMateriaPrima").setValue("");
        //             this.byId("iptQuantidade").setValue("");
        //         }
        //     })
        // },

        _validarEBuscarMP: function (sCodPA, sCodMP, sQtdMP) {
            var oModel = this.getView().getModel();
            var oViewModel = this.getView().getModel("viewModel");
            var aItensAtuais = oViewModel.getProperty("/itensBOM") || [];

            this.getView().setBusy(true);

            var sPathMaterial = oModel.createKey("/ZTPE_BOMSet", {
                Codigopa: sCodPA,
                Codigomp: sCodMP
            });

            oModel.read(sPathMaterial, {
                success: function (oData) {
                    oView.setBusy(false);
                    MessageBox.error("Esta combinação de PA e MP já existe.")
                },
                error: function (oError) {
                    oView.setBusy(false);

                    if (oError.statusCode === "404" || oError.statusCode === 404) {
                        MessageBox.success("Inserindo")
                    } else {
                        this._tratarErro();
                    }
                }
            })
        }

    });
});