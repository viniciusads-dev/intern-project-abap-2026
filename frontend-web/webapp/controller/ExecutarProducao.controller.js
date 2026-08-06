sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], function (BaseController, MessageToast, MessageBox, Filter, FilterOperator, JSONModel) {
    "use strict";

    return BaseController.extend("zpeweb.controller.ExecutarProducao", {

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "bomModel");
            
            this.getView().setModel(new JSONModel({
                hasResults: false,
                isBusy: false,
                descricaoPA: "",
                headerTitle: ""
            }), "viewModel");

            this.applySavedTheme();
            this.getRouter().getRoute("RouteExecutarProducao").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            const sMaterialPA = oEvent.getParameter("arguments")?.materialPA;
            if (sMaterialPA) {
                const oInput = this.byId("inputMaterial");
                if (oInput) {
                    oInput.setValue(sMaterialPA);
                    this.onBuscar();
                }
            }
        },

        // --- Helpers Locais de OData (Sem alterar o BaseController) ---
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

        _callFunction: function (sFunctionName, mParameters = {}, sMethod = "POST") {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();
                if (!oModel) return reject(new Error("Modelo OData não encontrado"));
                oModel.callFunction(sFunctionName, {
                    method: sMethod,
                    urlParameters: mParameters,
                    success: (oData) => resolve(oData),
                    error: (oError) => reject(oError)
                });
            });
        },

        // --- Ações ---
        onBuscar: async function () {
            const sMaterial = this.byId("inputMaterial").getValue().trim();
            if (!sMaterial) {
                MessageToast.show(this._getText("reportInputPA"));
                return;
            }

            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isBusy", true);

            try {
                const aBomRows = await this._readCollection("/ZTPE_BOMSet", [
                    new Filter("Codigopa", FilterOperator.EQ, sMaterial)
                ]);

                if (!aBomRows?.length) {
                    MessageToast.show(this._getText("reportBOMnull"));
                    oViewModel.setProperty("/hasResults", false);
                    return;
                }

                const sDescPA = aBomRows[0].Descricaopa || "";
                const sTextoHeader = sDescPA ? `${sMaterial} - ${sDescPA}` : this._getText("cadastroNull", [sMaterial]);

                const parseNum = (v) => parseFloat(String(v || "").replace(",", ".")) || 0;

                const aItemsEnriched = aBomRows.map((oBomItem) => ({
                    Codigomp: oBomItem.Codigomp,
                    Descricaocm: oBomItem.Descricaomp || this._getText("cadastroNullDesc"),
                    Quantidademp: parseNum(oBomItem.Quantidademp),
                    UnidadeMedidacm: oBomItem.UnidadeMedidacm || "UN"
                }));

                this.getView().getModel("bomModel").setData(aItemsEnriched);
                
                oViewModel.setProperty("/descricaoPA", sDescPA);
                oViewModel.setProperty("/headerTitle", this._getText("titleProdutoAcabado", [sTextoHeader]));
                oViewModel.setProperty("/hasResults", true);

            } catch (oError) {
                oViewModel.setProperty("/hasResults", false);
                this._tratarErro(oError, this._getText("errorFetchComponentsGateway"));
            } finally {
                oViewModel.setProperty("/isBusy", false);
            }
        },

        onProcessar: function () {
            const sMaterial = this.byId("inputMaterial").getValue().trim();
            if (!sMaterial) {
                MessageToast.show(this._getText("msgMaterialNulo"));
                return;
            }

            const oViewModel = this.getView().getModel("viewModel");
            const sNomeProduto = oViewModel.getProperty("/descricaoPA") || "NULL";

            MessageBox.confirm(this._getText("msgConfirmExecution", [sNomeProduto]), {
                title: this._getText("titleConfirmExecution"),
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;

                    oViewModel.setProperty("/isBusy", true);

                    try {
                        await this._callFunction("/ExecuteProductionProcess", {
                            Material: sMaterial,
                            Quantidade: 1
                        }, "POST");

                        MessageBox.success(this._getText("msgSuccessExecution", [sMaterial]), {
                            onClose: () => {
                                this.byId("inputMaterial").setValue("");
                                oViewModel.setProperty("/hasResults", false);
                                
                                this.getOwnerComponent().getEventBus().publish("Inventory", "StockChanged");
                            }
                        });

                    } catch (oError) {
                        const oErroInfo = this._extrairDetalhesErro ? this._extrairDetalhesErro(oError) : {};
                        const bErroEstoqueBOM = oErroInfo.aDetails?.some(d => d.code === "ZPE_MSG/007") ||
                            String(oErroInfo.sMensagem).toLowerCase().includes("bom") ||
                            String(oErroInfo.sMensagem).toLowerCase().includes("estoque");

                        if (bErroEstoqueBOM) {
                            MessageBox.warning(this._getText("msgWarningInsufficientInsumos"), {
                                title: this._getText("titleInsufficientInsumos"),
                                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                onClose: (sDialogAction) => {
                                    if (sDialogAction === MessageBox.Action.YES) {
                                        this.getRouter().navTo("RouteCentralCompras", { materialPA: sMaterial });
                                    }
                                }
                            });
                        } else {
                            this._tratarErro(oError, this._getText("errorExecuteProductionProcess"));
                        }
                    } finally {
                        oViewModel.setProperty("/isBusy", false);
                    }
                }
            });
        }
    });
});