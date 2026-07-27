sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (BaseController, MessageToast, MessageBox, Filter, FilterOperator, JSONModel) => {
    "use strict";

    return BaseController.extend("zpeweb.controller.ExecutarProducao", {

        onInit() {
            this.byId("panelResultado").setVisible(false);
            const oBomModel = new JSONModel([]);
            this.getView().setModel(oBomModel, "bomModel");
        },

        async onBuscar() {
            const sMaterial = this.byId("inputMaterial").getValue().trim();
            if (!sMaterial) {
                MessageToast.show(this._getText("reportInputPA"));
                return;
            }

            const oView = this.getView();
            const oPanelResultado = this.byId("panelResultado");
            const oTxtNomeProduto = this.byId("txtNomeProduto");
            oView.setBusy(true);

            try {
                const aBomRows = await this._readCollection("/ZTPE_BOMSet", [
                    new Filter("Codigopa", FilterOperator.EQ, sMaterial)
                ]);

                if (!aBomRows || aBomRows.length === 0) {
                    MessageToast.show(this._getText("reportBOMnull"));
                    oPanelResultado.setVisible(false);
                    return;
                }

                let sDescricaoPA = "";
                try {
                    const aPaRows = await this._readCollection("/ZTPE_MATERIALSet", [
                        new Filter("Codigocm", FilterOperator.EQ, sMaterial)
                    ]);
                    const sDesc = aPaRows && aPaRows[0] ? aPaRows[0].Descricaocm : null;
                    if (sDesc && sDesc.trim() !== "") {
                        sDescricaoPA = `${sMaterial} - ${sDesc}`;
                        this._sDescricaoPA = sDesc;
                    } else {
                        sDescricaoPA = this._getText("cadastroNull", [sMaterial]);
                        this._sDescricaoPA = "";
                    }
                } catch (oErrPA) {
                    sDescricaoPA = this._getText("cadastroNull", [sMaterial]);
                    this._sDescricaoPA = "";
                }

                const aMatFilters = aBomRows.map(oItem => new Filter("Codigocm", FilterOperator.EQ, oItem.Codigomp));
                const aMaterialRows = await this._readCollection("/ZTPE_MATERIALSet", [
                    new Filter({ filters: aMatFilters, and: false })
                ]);

                const mMapMateriais = aMaterialRows.reduce((mAcc, oMat) => {
                    mAcc[oMat.Codigocm] = oMat;
                    return mAcc;
                }, {});

                const fnParseNumber = (vVal) => {
                    if (vVal === null || vVal === undefined || vVal === "") return 0;
                    const nParsed = parseFloat(String(vVal).replace(",", "."));
                    return isNaN(nParsed) ? 0 : nParsed;
                };

                const aItemsEnriched = aBomRows.map((oBomItem) => {
                    const oMat = mMapMateriais[oBomItem.Codigomp] || {};
                    return {
                        Codigomp: oBomItem.Codigomp,
                        Descricaocm: oMat.Descricaocm || this._getText("cadastroNullDesc"),
                        Quantidademp: fnParseNumber(oBomItem.Quantidademp),
                        UnidadeMedidacm: oMat.UnidadeMedidacm || ""
                    };
                });

                oView.getModel("bomModel").setData(aItemsEnriched);
                oTxtNomeProduto.setText(this._getText("titleProdutoAcabado", [sDescricaoPA]));
                oPanelResultado.setVisible(true);

            } catch (oError) {
                oPanelResultado.setVisible(false);
                this._tratarErro(oError, this._getText("errorFetchComponentsGateway"));
            } finally {
                oView.setBusy(false);
            }
        },

        async onProcessar() {
            const sMaterial = this.byId("inputMaterial").getValue().trim();
            if (!sMaterial) {
                MessageToast.show(this._getText("msgMaterialNulo"));
                return;
            }

            const sNomeProduto = this._sDescricaoPA || "NULL";

            MessageBox.confirm(this._getText("msgConfirmExecution", [sNomeProduto]), {
                title: this._getText("titleConfirmExecution"),
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    const oView = this.getView();
                    const oPanelResultado = this.byId("panelResultado");
                    oView.setBusy(true);

                    try {
                        await this._callFunction("/ExecuteProductionProcess", {
                            Material: sMaterial,
                            Quantidade: 1
                        }, "POST");

                        MessageBox.success(this._getText("msgSuccessExecution", [sMaterial]), {
                            onClose: () => {
                                this.byId("inputMaterial").setValue("");
                                oPanelResultado.setVisible(false);
                            }
                        });

                    } catch (oError) {
                        const oErroInfo = this._extrairDetalhesErro(oError);
                        const bErroEstoqueBOM = oErroInfo.aDetails.some(d => d.code === "ZPE_MSG/007") ||
                            oErroInfo.sMensagem.toLowerCase().includes("bom") ||
                            oErroInfo.sMensagem.toLowerCase().includes("estoque") ||
                            oErroInfo.sMensagem.toLowerCase().includes("insuficiente");

                        if (bErroEstoqueBOM) {
                            MessageBox.warning(this._getText("msgWarningInsufficientInsumos"), {
                                title: this._getText("titleInsufficientInsumos"),
                                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                onClose: (sDialogAction) => {
                                    if (sDialogAction === MessageBox.Action.YES) {
                                        // Navegação simplificada herdada do BaseController
                                        this.getRouter().navTo("RouteCentralCompras", {
                                            materialPA: sMaterial
                                        });
                                    }
                                }
                            });
                        } else {
                            this._tratarErro(oError, this._getText("errorExecuteProductionProcess"));
                        }
                    } finally {
                        oView.setBusy(false);
                    }
                }
            });
        },

        _callFunction(sFunctionName, mParameters, sMethod = "GET") {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();
                if (!oModel) {
                    reject(new Error(this._getText("errorODataModelNotFound")));
                    return;
                }
                oModel.callFunction(sFunctionName, {
                    method: sMethod,
                    urlParameters: mParameters || {},
                    success: (oData) => resolve(oData),
                    error: (oError) => reject(oError)
                });
            });
        }
    });
});