sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/ui/layout/form/SimpleForm"
], (BaseController, Controller, JSONModel, UIComponent, MessageToast, MessageBox, Dialog, Button, Label, Input, SimpleForm) => {
    "use strict";

    return BaseController.extend("zpeweb.controller.UnidadeMedida", {
        onInit: function () {
            var oViewModel = new JSONModel({
                modoEdicao: false
            });
            this.getView().setModel(oViewModel, "viewModel");
            this.applySavedTheme();
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteCockpit");
        },

        // Função para abrir o dialogo de criação de unidade de medida
        onCriarUnidade: function () {
            var oView = this.getView();
            
            // Abrindo caixa de dialogo para inserir nova unidade
            if (!this._oDialogCadastro) {
                this._oDialogCadastro = new Dialog({
                    title: "Criar Unidade de Medida",
                    content: [
                        new SimpleForm({
                            content: [
                                new Label({ text: "Sigla" }),
                                new Input({ id: oView.createId("iptSigla"), maxLength: 2, placeholder: "Ex: KG" }),
                                new Label({ text: "Descrição" }),
                                new Input({ id: oView.createId("iptDescricao"), maxLength: 30 })
                            ]
                        }) 
                    ],
                    beginButton: new Button({
                        text: "Salvar",
                        press: function () {
                            this.onSalvarUnidade();
                        }.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cancelar",
                        press: function () {
                            this._oDialogCadastro.close();
                            this.byId("iptSigla").setValue("");
                            this.byId("iptDescricao").setValue("");
                        }.bind(this)
                    })
                });
                oView.addDependent(this._oDialogCadastro);
            }
            this._oDialogCadastro.open();
        },

        onSalvarUnidade: function () {
            var oModel = this.getView().getModel();

            var oInputSigla = this.byId("iptSigla");
            var oInputDescricao = this.byId("iptDescricao");

            var sSigla = oInputSigla ? oInputSigla.getValue() : "";
            var sDescricao = oInputDescricao ? oInputDescricao.getValue() : "";

            if (!sSigla || !sDescricao) {
                MessageToast.show("Preencha todos os campos.");
                return;
            }

            var oPayLoad = {
                Codigounm: sSigla.toUpperCase(),
                Descricaounm: sDescricao
            };

            // Dispara o POST para o EntitySet ZTPE_UNMEDIDASet para criar uma nova unidade de medida
            oModel.create("/ZTPE_UNMEDIDASet", oPayLoad, {
                success: function () {
                    MessageToast.show("Unidade de Medida cadastrada com sucesso!");
                    this._oDialogCadastro.close();
                    // Limpa os campos
                    oInputSigla.setValue("");
                    oInputDescricao.setValue("");
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Erro ao cadastrar Unidade de Medida.");
                }
            })
        },

        onDeletarUnidade: function () {
            var oTable = this.byId("tableUnidades");
            var aSelectedItems = oTable.getSelectedItems();
            var oModel = this.getView().getModel();

            if (aSelectedItems.length === 0) {
                MessageToast.show("Selecione pelo menos uma linha para deletar.");
                return;
            }

            MessageBox.confirm("Deseja realmente deletar as unidades selecionadas?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        // Pega a rota da linha selecionada e faz o DELETE
                        aSelectedItems.forEach(function (oItem) {
                            var sPath = oItem.getBindingContext().getPath();
                            // Dispara o DELETE para o Gateway
                            oModel.remove(sPath, {
                                success: function () {
                                    MessageToast.show("Unidade de Medida deletada com sucesso!");
                                },
                                error: function (oError) {
                                    MessageBox.error("Erro ao deletar Unidade de Medida.");
                                }
                            });
                        });
                        oTable.removeSelections(); // Limpa a seleção da tabela após deletar
                    }
                }.bind(this)
            });
        },

        // Funcionalidade para alternar entre modo de edição e visualização da tabela
        onAlternarEdicao: function () {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/modoEdicao", true);
        },

        // Função para cancelar alterações feitas na tabela e voltar ao modo de visualização
        onCancelarAlteracoes: function () {
            var oModel = this.getView().getModel();

            if (oModel.hasPendingChanges()) {
                oModel.resetChanges();
            }

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/modoEdicao", false);
        },

        // Função para salvar alterações feitas na tabela e enviar para o backend
        onSalvarAlteracoes: function () {
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }

            var oModel = this.getView().getModel();
            var oViewModel = this.getView().getModel("viewModel");

            if (!oModel.hasPendingChanges()) {
                MessageToast.show("Nenhuma alteração foi realizada.");
                oViewModel.setProperty("/modoEdicao", false);
                return;
            }
            oModel.submitChanges({
                success: function (oData) {
                    MessageToast.show("Alterações salvas com sucesso!");
                    oViewModel.setProperty("/modoEdicao", false);
                }.bind(this),

                error: function (oError) {
                    MessageBox.error("Erro ao conectar com o servidor.");
                }
            });
        }

    });
});