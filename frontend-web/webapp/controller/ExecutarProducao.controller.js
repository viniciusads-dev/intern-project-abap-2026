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
            this.applySavedTheme();
            this.getRouter().getRoute("RouteExecutarProducao").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const sMaterialPA = oArgs?.materialPA;

            if (sMaterialPA) {
                const oInput = this.byId("inputMaterial");
                if (oInput) {
                    oInput.setValue(sMaterialPA);
                    this.onBuscar();
                }
            }
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
                // busca componentes BOM, que agora trazem a decricao
                const aBomRows = await this._readCollection("/ZTPE_BOMSet", [
                    new Filter("Codigopa", FilterOperator.EQ, sMaterial)
                ]);

                if (!aBomRows || aBomRows.length === 0) {
                    MessageToast.show(this._getText("reportBOMnull"));
                    oPanelResultado.setVisible(false);
                    return;
                }

                // descricao do PA
                const sDescPA = aBomRows[0].Descricaopa || "";
                this._sDescricaoPA = sDescPA;

                const sTextoHeader = sDescPA ? `${sMaterial} - ${sDescPA}` : this._getText("cadastroNull", [sMaterial]);

                const fnParseNumber = (vVal) => {
                    if (vVal === null || vVal === undefined || vVal === "") return 0;
                    const nParsed = parseFloat(String(vVal).replace(",", "."));
                    return isNaN(nParsed) ? 0 : nParsed;
                };

                // mapeia os materiais usando mp do gateway
                const aItemsEnriched = aBomRows.map((oBomItem) => ({
                    Codigomp: oBomItem.Codigomp,
                    Descricaocm: oBomItem.Descricaomp || this._getText("cadastroNullDesc"),
                    Quantidademp: fnParseNumber(oBomItem.Quantidademp),
                    UnidadeMedidacm: oBomItem.UnidadeMedidacm || "UN"
                }));

                oView.getModel("bomModel").setData(aItemsEnriched);
                oTxtNomeProduto.setText(this._getText("titleProdutoAcabado", [sTextoHeader]));
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