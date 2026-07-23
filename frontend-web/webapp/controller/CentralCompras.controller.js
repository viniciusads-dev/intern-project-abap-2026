sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment"
], (Controller, UIComponent, MessageToast, MessageBox, Filter, FilterOperator, JSONModel, Fragment) => {
    "use strict";

    return Controller.extend("zpeweb.controller.CentralCompras", {

        onInit() {
            // modelo local p tabela
            const oComprasModel = new JSONModel([]);
            this.getView().setModel(oComprasModel, "comprasModel");

            const oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteCentralCompras").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sMaterialPA = oArgs.materialPA;

            const oInput = this.byId("inputProdutoAcabado");

            if (sMaterialPA) {
                // preenche o input e ja dispara a busca caso venha da tela de prod
                oInput.setValue(sMaterialPA);
                this.onBuscar();
            } else {
                // se abriu a tela pelo menu, limpa a busca anterior
                oInput.setValue("");
                this.getView().getModel("comprasModel").setData([]);
                this.byId("panelResultadoCompras").setVisible(false);
            }
        },

        onNavBack() {
            window.history.go(-1);
        },

        // validação no input para aceitar somente numeros
        onInputLiveChange(oEvent) {
            const oInput = oEvent.getSource();
            const sValue = oEvent.getParameter("value");
            const sOnlyNumbers = sValue.replace(/\D/g, "");

            if (sValue !== sOnlyNumbers) {
                oInput.setValue(sOnlyNumbers);
            }
        },

        // busca INDIVIDUAL
        async onBuscar() {
            const sMaterialPA = this.byId("inputProdutoAcabado").getValue().trim();

            if (!sMaterialPA) {
                MessageToast.show("Informe o código do produto acabado.");
                return;
            }

            const oView = this.getView();
            const oPanelResultado = this.byId("panelResultadoCompras");

            oView.setBusy(true);

            try {
                const aBomRows = await this._readCollection("/ZTPE_BOMSet", [
                    new Filter("Codigopa", FilterOperator.EQ, sMaterialPA)
                ]);

                if (!aBomRows || aBomRows.length === 0) {
                    MessageToast.show("Nenhuma estrutura (BOM) encontrada para este produto.");
                    oPanelResultado.setVisible(false);
                    return;
                }

                await this._processarEExibirBOMs(aBomRows);

            } catch (oError) {
                oPanelResultado.setVisible(false);
                this._tratarErro(oError, "Erro ao carregar dados de compras.");
            } finally {
                oView.setBusy(false);
            }
        },

        // busca GERAL
        async onBuscarTodos() {
            const oView = this.getView();
            const oPanelResultado = this.byId("panelResultadoCompras");

            // limpa o campo de busca unica
            this.byId("inputProdutoAcabado").setValue("");

            oView.setBusy(true);

            try {
                const aBomRows = await this._readCollection("/ZTPE_BOMSet");

                if (!aBomRows || aBomRows.length === 0) {
                    MessageToast.show("Nenhuma estrutura (BOM) cadastrada no sistema.");
                    oPanelResultado.setVisible(false);
                    return;
                }

                await this._processarEExibirBOMs(aBomRows);

            } catch (oError) {
                oPanelResultado.setVisible(false);
                this._tratarErro(oError, "Erro ao carregar todas as estruturas.");
            } finally {
                oView.setBusy(false);
            }
        },

        // metodo auxiliar para cruzar dados de BOM + Cadastro de Materiais + Estoque Real
        async _processarEExibirBOMs(aBomRows) {
            const oPanelResultado = this.byId("panelResultadoCompras");

            // normaliza chaves removendo zero a esquerda
            const fnNormalizeKey = (sVal) => String(sVal || "").trim().replace(/^0+/, "");

            // converte numeros 
            const fnParseNumber = (vVal) => {
                if (vVal === null || vVal === undefined || vVal === "") return 0;
                const nParsed = parseFloat(String(vVal).replace(",", "."));
                return isNaN(nParsed) ? 0 : nParsed;
            };

            const aCodigosUnicos = [...new Set([
                ...aBomRows.map(b => b.Codigopa),
                ...aBomRows.map(b => b.Codigomp)
            ])].filter(Boolean);

            // busca no cadastro de material
            let aMaterialRows = [];
            if (aCodigosUnicos.length > 0) {
                const aMatFilters = aCodigosUnicos.map(sCod => new Filter("Codigocm", FilterOperator.EQ, sCod));
                const oCombinedMatFilter = new Filter({
                    filters: aMatFilters,
                    and: false
                });
                aMaterialRows = await this._readCollection("/ZTPE_MATERIALSet", [oCombinedMatFilter]);
            }

            // busca estoque
            let aEstoqueRows = [];
            try {
                aEstoqueRows = await this._readCollection("/ZSTR_ESTOQUE_ODATASet");
            } catch (oErrEst) {
                console.warn("Aviso ao carregar /ZSTR_ESTOQUE_ODATASet:", oErrEst);
            }

            // Mapa do Cadastro de Materiais (Chave: Codigocm)
            const mMapMateriais = aMaterialRows.reduce((mAcc, oMat) => {
                const sKey = fnNormalizeKey(oMat.Codigocm);
                mAcc[sKey] = oMat;
                return mAcc;
            }, {});

            // Mapa do Estoque Real com base no retorno XML (Chave: Codigom | Valor: Quantidadem)
            const mMapEstoque = aEstoqueRows.reduce((mAcc, oEst) => {
                const sKey = fnNormalizeKey(oEst.Codigom);
                mAcc[sKey] = fnParseNumber(oEst.Quantidadem);
                return mAcc;
            }, {});

            // monta tabela e calcula necessidade
            const aItemsCalculados = aBomRows.map((oBomItem) => {
                const sKeyPA = fnNormalizeKey(oBomItem.Codigopa);
                const sKeyMP = fnNormalizeKey(oBomItem.Codigomp);

                const oMatPA = mMapMateriais[sKeyPA] || {};
                const oMatMP = mMapMateriais[sKeyMP] || {};

                const nQtdNecessaria = fnParseNumber(oBomItem.Quantidademp);

                // busca quantidade no estoque
                const nQtdEstoque = mMapEstoque[sKeyMP] ?? 0;

                const nQtdComprar = Math.max(0, nQtdNecessaria - nQtdEstoque);

                return {
                    Codigopa: oBomItem.Codigopa,
                    Descricaopa: oMatPA.Descricaocm || "NULL (problemas no cadastro)",
                    Codigomp: oBomItem.Codigomp,
                    Descricaomp: oMatMP.Descricaocm || "NULL (problemas no cadastro)",
                    UnidadeMedida: oMatMP.UnidadeMedidacm || "UN",
                    QtdNecessaria: nQtdNecessaria,
                    QtdEstoque: nQtdEstoque,
                    QtdComprar: nQtdComprar
                };
            });

            this.getView().getModel("comprasModel").setData(aItemsCalculados);
            oPanelResultado.setVisible(true);
        },

        // gera pedido
        async onGerarPedido() {
            const oTable = this.byId("tblPedidoCompra");
            const aSelectedContexts = oTable.getSelectedContexts();

            if (aSelectedContexts.length === 0) {
                MessageToast.show("Selecione ao menos uma matéria-prima na tabela.");
                return;
            }

            const aSelectedItems = aSelectedContexts.map(oCtx => oCtx.getObject());
            const aItensComprar = aSelectedItems.filter(item => item.QtdComprar > 0);

            if (aItensComprar.length === 0) {
                MessageBox.information("Os itens selecionados possuem estoque suficiente! Nenhuma compra necessária.");
                return;
            }

            let sResumo = aItensComprar.map(i => `- MP: ${i.Codigomp} (${i.Descricaomp}) | Qtd a Comprar: ${i.QtdComprar} ${i.UnidadeMedida}`).join("\n");

            MessageBox.confirm(`Confirma a criação do Pedido de Compra para os itens selecionados?\n\n${sResumo}`, {
                title: "Gerar Pedido de Compra",
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    const oView = this.getView();
                    oView.setBusy(true);

                    // monta lista
                    const aItensPayload = aItensComprar.map(item => ({
                        Numeropedido: "0000",
                        Codigomp: item.Codigomp,
                        Quantidademp: String(item.QtdComprar)
                    }));

                    // envia estrutura p back end
                    const oPayload = {
                        Numeropedido: "0000",
                        Datap: "2026-06-23T00:00:00",
                        ZTPE_PED_ITEMSet: aItensPayload
                    };

                    try {
                        // chama serviço POST
                        const oResult = await this._createEntity("/ZTPE_PED_CABSet", oPayload);
                        const sNumPedido = oResult?.Numeropedido ? oResult.Numeropedido : "";

                        const sMsgSucesso = sNumPedido && sNumPedido !== "0000"
                            ? `Pedido de compra nº ${sNumPedido} criado com sucesso!`
                            : "Pedido de compra gerado com sucesso!";

                        MessageBox.success(sMsgSucesso, {
                            onClose: () => {
                                // limpa seleção da tabela
                                oTable.removeSelections(true);

                                // atualiza a tabela
                                const sInputVal = this.byId("inputProdutoAcabado").getValue().trim();
                                if (sInputVal) {
                                    this.onBuscar();
                                } else {
                                    this.onBuscarTodos();
                                }
                            }
                        });

                    } catch (oError) {
                        this._tratarErro(oError, "Erro ao gerar o pedido de compra.");
                    } finally {
                        oView.setBusy(false);
                    }
                }
            });
        },

        // popup search help vindo do ambiente ECC
        async onValueHelpMaterial() {
            const oView = this.getView();

            if (!this._pDialogMaterial) {
                this._pDialogMaterial = Fragment.load({
                    id: oView.getId(),
                    name: "zpeweb.view.fragments.ValueHelpMaterial",
                    controller: this
                }).then((oDialog) => {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            const oDialog = await this._pDialogMaterial;
            oDialog.getBinding("items").filter([]);
            oDialog.open();
        },

        onValueHelpSearch(oEvent) {
            // converte o input pra maisuculo
            const sRawValue = oEvent.getParameter("value") || "";
            const sValue = sRawValue.trim().toUpperCase();

            const oBinding = oEvent.getSource().getBinding("items");
            if (!oBinding) {
                return;
            }

            if (!sValue) {
                oBinding.filter([]);
                return;
            }

            // filtro ignorando case sensitive
            const aFilters = [
                new Filter({
                    filters: [
                        new Filter({
                            path: "Codigocm",
                            operator: FilterOperator.Contains,
                            value1: sValue,
                            caseSensitive: false
                        }),
                        new Filter({
                            path: "Descricaocm",
                            operator: FilterOperator.Contains,
                            value1: sValue,
                            caseSensitive: false
                        })
                    ],
                    and: false
                })
            ];

            oBinding.filter(aFilters);
        },

        // ao selecionar a pesquisa
        onValueHelpClose(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");

            if (oSelectedItem) {
                const sSelectedCode = oSelectedItem.getTitle();

                // seta o valor no input
                this.byId("inputProdutoAcabado").setValue(sSelectedCode);

                // ja busca automaticamente
                this.onBuscar();
            }

            oEvent.getSource().getBinding("items").filter([]);
        },

        // Helper para GET no OData
        _readCollection(sPath, aFilters) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();

                if (!oModel) {
                    reject(new Error("Modelo OData não encontrado."));
                    return;
                }

                oModel.read(sPath, {
                    filters: aFilters || [],
                    success: (oData) => resolve(Array.isArray(oData && oData.results) ? oData.results : []),
                    error: (oError) => reject(oError)
                });
            });
        },

        // Helper para POST no OData (Deep Insert)
        _createEntity(sPath, oPayload) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();

                if (!oModel) {
                    reject(new Error("Modelo OData não encontrado."));
                    return;
                }

                oModel.create(sPath, oPayload, {
                    success: (oData) => resolve(oData),
                    error: (oError) => reject(oError)
                });
            });
        },

        _tratarErro(oError, sMensagemPadrao) {
            let sMensagem = "";
            try {
                const oResponseBody = JSON.parse(oError.responseText);
                sMensagem = oResponseBody?.error?.message?.value;
            } catch (e) {
                sMensagem = oError?.message;
            }
            MessageBox.error(sMensagem || sMensagemPadrao);
        }
    });
});