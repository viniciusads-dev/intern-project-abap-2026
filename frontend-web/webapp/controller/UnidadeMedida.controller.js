sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/ui/layout/form/SimpleForm"
], (Controller, UIComponent, MessageToast, MessageBox, Dialog, Button, Label, Input, SimpleForm) => {
    "use strict";

    return Controller.extend("zpeweb.controller.UnidadeMedida", {
        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteCockpit");
        },

        onCriarUnidade: function () {
            var oView = this.getView();
            
            // Abrindo caixa de dialogo para inserir nova unidade
            if (!this._oDialogCadastro) {
                this._oDialogCadastro = new Dialog({
                    title: "Nova Unidade de Medida",
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
                        aSelectedItems.forEach(function (oItem) {
                            // Pega a rota da linha selecionada e faz o DELETE
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
        }
    });
});