sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], function (BaseController, MessageToast, MessageBox, Filter, FilterOperator, JSONModel) {
    "use strict";

    return BaseController.extend("zpeweb.controller.CentralCompras", {

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "comprasModel");
            
            this.getView().setModel(new JSONModel({
                hasResults: false,
                isBusy: false
            }), "viewModel");

            this.applySavedTheme();
            this.getRouter().getRoute("RouteCentralCompras").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            const sMaterialPA = oEvent.getParameter("arguments")?.materialPA;
            const oInput = this.byId("inputProdutoAcabado");

            if (sMaterialPA) {
                oInput.setValue(sMaterialPA);
                this.onBuscar();
            } else {
                oInput.setValue("");
                this.getView().getModel("comprasModel").setData([]);
                this.getView().getModel("viewModel").setProperty("/hasResults", false);
            }
        },

        _readCollection: function (sPath, aFilters = []) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();
                if (!oModel) return reject(new Error("Modelo OData não encontrado"));
                oModel.read(sPath, {
                    filters: aFilters,
                    success: (oData) => resolve(oData.results || []),
                    error: (oError) => reject(oError)
                });
            });
        },

        _createEntity: function (sPath, oPayload) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();
                if (!oModel) return reject(new Error("Modelo OData não encontrado"));
                oModel.create(sPath, oPayload, {
                    success: (oData) => resolve(oData),
                    error: (oError) => reject(oError)
                });
            });
        },

        onBuscar: async function () {
            const sMaterialPA = this.byId("inputProdutoAcabado").getValue().trim();
            if (!sMaterialPA) {
                MessageToast.show(this._getText("reportInputPA"));
                return;
            }

            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isBusy", true);

            try {
                const aBomRows = await this._readCollection("/ZTPE_BOMSet", [
                    new Filter("Codigopa", FilterOperator.EQ, sMaterialPA)
                ]);

                if (!aBomRows?.length) {
                    MessageToast.show(this._getText("reportBOMnull"));
                    oViewModel.setProperty("/hasResults", false);
                    return;
                }
                await this._processarEExibirBOMs(aBomRows);
            } catch (oError) {
                oViewModel.setProperty("/hasResults", false);
                this._tratarErro(oError, this._getText("errorFetchComprasData"));
            } finally {
                oViewModel.setProperty("/isBusy", false);
            }
        },

        onBuscarTodos: async function () {
            const oViewModel = this.getView().getModel("viewModel");
            this.byId("inputProdutoAcabado").setValue("");
            oViewModel.setProperty("/isBusy", true);

            try {
                const aBomRows = await this._readCollection("/ZTPE_BOMSet");
                if (!aBomRows?.length) {
                    MessageToast.show(this._getText("reportNoBOMsInSystem"));
                    oViewModel.setProperty("/hasResults", false);
                    return;
                }
                await this._processarEExibirBOMs(aBomRows);
            } catch (oError) {
                oViewModel.setProperty("/hasResults", false);
                this._tratarErro(oError, this._getText("errorFetchAllBOMs"));
            } finally {
                oViewModel.setProperty("/isBusy", false);
            }
        },

        _processarEExibirBOMs: async function (aBomRows) {
            let aEstoqueRows = [];
            try {
                aEstoqueRows = await this._readCollection("/ZSTR_ESTOQUE_ODATASet");
            } catch (oErrEst) {
                console.warn(this._getText("warnFetchEstoque"), oErrEst);
            }

            const normalizeKey = (v) => String(v || "").trim().replace(/^0+/, "");
            const parseNum = (v) => parseFloat(String(v || "").replace(",", ".")) || 0;

            const mMapEstoque = aEstoqueRows.reduce((mAcc, oEst) => {
                mAcc[normalizeKey(oEst.Codigom)] = parseNum(oEst.Quantidadem);
                return mAcc;
            }, {});

            const aItemsCalculados = aBomRows.map((oBomItem) => {
                const sKeyMP = normalizeKey(oBomItem.Codigomp);
                const nQtdNecessaria = parseNum(oBomItem.Quantidademp);
                const nQtdEstoque = mMapEstoque[sKeyMP] ?? 0;

                return {
                    Codigopa: oBomItem.Codigopa,
                    Descricaopa: oBomItem.Descricaopa || this._getText("cadastroNullDesc"),
                    Codigomp: oBomItem.Codigomp,
                    Descricaomp: oBomItem.Descricaomp || this._getText("cadastroNullDesc"),
                    UnidadeMedida: oBomItem.UnidadeMedidacm || "UN",
                    QtdNecessaria: nQtdNecessaria,
                    QtdEstoque: nQtdEstoque,
                    QtdComprar: Math.max(0, nQtdNecessaria - nQtdEstoque)
                };
            });

            this.getView().getModel("comprasModel").setData(aItemsCalculados);
            this.getView().getModel("viewModel").setProperty("/hasResults", true);
        },

        onGerarPedido: function () {
            const oTable = this.byId("tblPedidoCompra");
            const aSelectedContexts = oTable.getSelectedContexts();

            if (!aSelectedContexts.length) {
                MessageToast.show(this._getText("msgSelectAtLeastOneMP"));
                return;
            }

            const aItensComprar = aSelectedContexts
                .map(oCtx => oCtx.getObject())
                .filter(item => item.QtdComprar > 0);

            if (!aItensComprar.length) {
                MessageBox.information(this._getText("msgSufficientStockNoPurchase"));
                return;
            }

            const sResumo = aItensComprar.map(i =>
                this._getText("msgPOItemLine", [i.Codigomp, i.Descricaomp, i.QtdComprar, i.UnidadeMedida])
            ).join("\n");

            MessageBox.confirm(this._getText("msgConfirmCreatePO", [sResumo]), {
                title: this._getText("titleCreatePO"),
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    const oViewModel = this.getView().getModel("viewModel");
                    oViewModel.setProperty("/isBusy", true);

                    const dNow = new Date();
                    const sFechaFormatted = dNow.toISOString().split(".")[0];

                    const oPayload = {
                        Numeropedido: "0000",
                        Datap: sFechaFormatted,
                        ZTPE_PED_ITEMSet: aItensComprar.map(item => ({
                            Numeropedido: "0000",
                            Codigomp: item.Codigomp,
                            Quantidademp: String(item.QtdComprar)
                        }))
                    };

                    try {
                        const oResult = await this._createEntity("/ZTPE_PED_CABSet", oPayload);
                        const sNumPedido = oResult?.Numeropedido && oResult.Numeropedido !== "0000" ? oResult.Numeropedido : "";
                        const sMsgSucesso = sNumPedido
                            ? this._getText("msgPOSuccessWithNum", [sNumPedido])
                            : this._getText("msgPOSuccess");

                        const aPAsUnicos = [...new Set(aItensComprar.map(item => item.Codigopa))];
                        const sCodigoPA = aPAsUnicos.length === 1 ? aPAsUnicos[0] : null;

                        if (sCodigoPA) {
                            MessageBox.success(
                                this._getText("msgConfirmGoToProduction", [sMsgSucesso, sCodigoPA]),
                                {
                                    title: this._getText("msgPOSuccess"),
                                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                    emphasizedAction: MessageBox.Action.YES,
                                    onClose: (sDlgAction) => {
                                        this._finalizarPedido(oTable);
                                        if (sDlgAction === MessageBox.Action.YES) {
                                            this.getRouter().navTo("RouteExecutarProducao", { materialPA: sCodigoPA });
                                        }
                                    }
                                }
                            );
                        } else {
                            MessageBox.success(sMsgSucesso, {
                                onClose: () => this._finalizarPedido(oTable)
                            });
                        }
                    } catch (oError) {
                        this._tratarErro(oError, this._getText("errorCreatePO"));
                    } finally {
                        oViewModel.setProperty("/isBusy", false);
                    }
                }
            });
        },

        _finalizarPedido: function (oTable) {
            oTable.removeSelections(true);
            const sInputVal = this.byId("inputProdutoAcabado").getValue().trim();
            sInputVal ? this.onBuscar() : this.onBuscarTodos();
        }
    });
});