sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (BaseController, MessageToast, MessageBox, Filter, FilterOperator, JSONModel) => {
    "use strict";

    return BaseController.extend("zpeweb.controller.CentralCompras", {

        onInit() {
            const oComprasModel = new JSONModel([]);
            this.getView().setModel(oComprasModel, "comprasModel");

            this.getRouter().getRoute("RouteCentralCompras").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sMaterialPA = oArgs.materialPA;
            const oInput = this.byId("inputProdutoAcabado");

            if (sMaterialPA) {
                oInput.setValue(sMaterialPA);
                this.onBuscar();
            } else {
                oInput.setValue("");
                this.getView().getModel("comprasModel").setData([]);
                this.byId("panelResultadoCompras").setVisible(false);
            }
        },

        async onBuscar() {
            const sMaterialPA = this.byId("inputProdutoAcabado").getValue().trim();
            if (!sMaterialPA) {
                MessageToast.show(this._getText("reportInputPA"));
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
                    MessageToast.show(this._getText("reportBOMnull"));
                    oPanelResultado.setVisible(false);
                    return;
                }
                await this._processarEExibirBOMs(aBomRows);
            } catch (oError) {
                oPanelResultado.setVisible(false);
                this._tratarErro(oError, this._getText("errorFetchComprasData"));
            } finally {
                oView.setBusy(false);
            }
        },

        async onBuscarTodos() {
            const oView = this.getView();
            const oPanelResultado = this.byId("panelResultadoCompras");
            this.byId("inputProdutoAcabado").setValue("");
            oView.setBusy(true);

            try {
                const aBomRows = await this._readCollection("/ZTPE_BOMSet");
                if (!aBomRows || aBomRows.length === 0) {
                    MessageToast.show(this._getText("reportNoBOMsInSystem"));
                    oPanelResultado.setVisible(false);
                    return;
                }
                await this._processarEExibirBOMs(aBomRows);
            } catch (oError) {
                oPanelResultado.setVisible(false);
                this._tratarErro(oError, this._getText("errorFetchAllBOMs"));
            } finally {
                oView.setBusy(false);
            }
        },

        async _processarEExibirBOMs(aBomRows) {
            const oPanelResultado = this.byId("panelResultadoCompras");
            const fnNormalizeKey = (sVal) => String(sVal || "").trim().replace(/^0+/, "");
            const fnParseNumber = (vVal) => {
                if (vVal === null || vVal === undefined || vVal === "") return 0;
                const nParsed = parseFloat(String(vVal).replace(",", "."));
                return isNaN(nParsed) ? 0 : nParsed;
            };

            const aCodigosUnicos = [...new Set([
                ...aBomRows.map(b => b.Codigopa),
                ...aBomRows.map(b => b.Codigomp)
            ])].filter(Boolean);

            let aMaterialRows = [];
            let aEstoqueRows = [];

            // Disparos em paralelo para máxima performance
            const aPromises = [];

            if (aCodigosUnicos.length > 0) {
                const aMatFilters = aCodigosUnicos.map(sCod => new Filter("Codigocm", FilterOperator.EQ, sCod));
                const oCombinedMatFilter = new Filter({ filters: aMatFilters, and: false });
                aPromises.push(this._readCollection("/ZTPE_MATERIALSet", [oCombinedMatFilter]).then(res => aMaterialRows = res));
            }

            aPromises.push(this._readCollection("/ZSTR_ESTOQUE_ODATASet").then(res => aEstoqueRows = res).catch(oErrEst => {
                console.warn(this._getText("warnFetchEstoque"), oErrEst);
            }));

            await Promise.all(aPromises);

            const mMapMateriais = aMaterialRows.reduce((mAcc, oMat) => {
                mAcc[fnNormalizeKey(oMat.Codigocm)] = oMat;
                return mAcc;
            }, {});

            const mMapEstoque = aEstoqueRows.reduce((mAcc, oEst) => {
                mAcc[fnNormalizeKey(oEst.Codigom)] = fnParseNumber(oEst.Quantidadem);
                return mAcc;
            }, {});

            const aItemsCalculados = aBomRows.map((oBomItem) => {
                const sKeyPA = fnNormalizeKey(oBomItem.Codigopa);
                const sKeyMP = fnNormalizeKey(oBomItem.Codigomp);
                const oMatPA = mMapMateriais[sKeyPA] || {};
                const oMatMP = mMapMateriais[sKeyMP] || {};
                const nQtdNecessaria = fnParseNumber(oBomItem.Quantidademp);
                const nQtdEstoque = mMapEstoque[sKeyMP] ?? 0;
                const nQtdComprar = Math.max(0, nQtdNecessaria - nQtdEstoque);

                return {
                    Codigopa: oBomItem.Codigopa,
                    Descricaopa: oMatPA.Descricaocm || this._getText("cadastroNullDesc"),
                    Codigomp: oBomItem.Codigomp,
                    Descricaomp: oMatMP.Descricaocm || this._getText("cadastroNullDesc"),
                    UnidadeMedida: oMatMP.UnidadeMedidacm || "UN",
                    QtdNecessaria: nQtdNecessaria,
                    QtdEstoque: nQtdEstoque,
                    QtdComprar: nQtdComprar
                };
            });

            this.getView().getModel("comprasModel").setData(aItemsCalculados);
            oPanelResultado.setVisible(true);
        },

        async onGerarPedido() {
            const oTable = this.byId("tblPedidoCompra");
            const aSelectedContexts = oTable.getSelectedContexts();

            if (aSelectedContexts.length === 0) {
                MessageToast.show(this._getText("msgSelectAtLeastOneMP"));
                return;
            }

            const aSelectedItems = aSelectedContexts.map(oCtx => oCtx.getObject());
            const aItensComprar = aSelectedItems.filter(item => item.QtdComprar > 0);

            if (aItensComprar.length === 0) {
                MessageBox.information(this._getText("msgSufficientStockNoPurchase"));
                return;
            }

            let sResumo = aItensComprar.map(i =>
                this._getText("msgPOItemLine", [i.Codigomp, i.Descricaomp, i.QtdComprar, i.UnidadeMedida])
            ).join("\n");

            MessageBox.confirm(this._getText("msgConfirmCreatePO", [sResumo]), {
                title: this._getText("titleCreatePO"),
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    const oView = this.getView();
                    oView.setBusy(true);

                    const aItensPayload = aItensComprar.map(item => ({
                        Numeropedido: "0000",
                        Codigomp: item.Codigomp,
                        Quantidademp: String(item.QtdComprar)
                    }));

                    const oPayload = {
                        Numeropedido: "0000",
                        Datap: "2026-06-23T00:00:00", // Payload mantido conforme regra do backend
                        ZTPE_PED_ITEMSet: aItensPayload
                    };

                    try {
                        const oResult = await this._createEntity("/ZTPE_PED_CABSet", oPayload);
                        const sNumPedido = oResult?.Numeropedido ? oResult.Numeropedido : "";
                        const sMsgSucesso = (sNumPedido && sNumPedido !== "0000")
                            ? this._getText("msgPOSuccessWithNum", [sNumPedido])
                            : this._getText("msgPOSuccess");

                        MessageBox.success(sMsgSucesso, {
                            onClose: () => {
                                oTable.removeSelections(true);
                                const sInputVal = this.byId("inputProdutoAcabado").getValue().trim();
                                sInputVal ? this.onBuscar() : this.onBuscarTodos();
                            }
                        });
                    } catch (oError) {
                        this._tratarErro(oError, this._getText("errorCreatePO"));
                    } finally {
                        oView.setBusy(false);
                    }
                }
            });
        },

        _createEntity(sPath, oPayload) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();
                if (!oModel) {
                    reject(new Error(this._getText("errorODataModelNotFound")));
                    return;
                }
                oModel.create(sPath, oPayload, {
                    success: (oData) => resolve(oData),
                    error: (oError) => reject(oError)
                });
            });
        }
    });
});