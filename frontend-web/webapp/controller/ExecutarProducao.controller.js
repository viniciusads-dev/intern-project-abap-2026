sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/ObjectNumber",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment"
], (Controller, UIComponent, MessageToast, MessageBox, Filter, FilterOperator, ColumnListItem, Text, ObjectNumber, JSONModel, Fragment) => {
    "use strict";

    return Controller.extend("zpeweb.controller.ExecutarProducao", {

        // helper para tradução
        _getText(sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        onInit() {
            this.byId("panelResultado").setVisible(false);

            // inicializa o modelo, uma vez 
            const oBomModel = new JSONModel([]);
            this.getView().setModel(oBomModel, "bomModel");

            // template tabela
            const oTable = this.byId("tblMateriasPrima");
            if (oTable && !oTable.getBinding("items")) {
                const oItemTemplate = new ColumnListItem({
                    cells: [
                        new Text({ text: "{bomModel>Codigomp}" }),
                        new Text({ text: "{bomModel>Descricaocm}" }),
                        new ObjectNumber({
                            number: {
                                path: "bomModel>Quantidademp",
                                type: "sap.ui.model.type.Float",
                                formatOptions: {
                                    minFractionDigits: 0,
                                    maxFractionDigits: 3
                                }
                            },
                            unit: "{bomModel>UnidadeMedidacm}"
                        })
                    ]
                });

                oTable.bindItems({
                    path: "bomModel>/",
                    template: oItemTemplate
                });
            }
        },

        // permite somente numeros
        onInputLiveChange(oEvent) {
            const oInput = oEvent.getSource();
            const sValue = oEvent.getParameter("value");

            // remove tudo o que NÃO for numeros (0-9)
            const sOnlyNumbers = sValue.replace(/\D/g, "");

            if (sValue !== sOnlyNumbers) {
                oInput.setValue(sOnlyNumbers);
            }
        },

        onNavBack() {
            window.history.go(-1);
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

            const aBomFilters = [
                new Filter("Codigopa", FilterOperator.EQ, sMaterial)
            ];

            try {
                // busca BOM
                const aBomRows = await this._readCollection("/ZTPE_BOMSet", aBomFilters);

                if (!aBomRows || aBomRows.length === 0) {
                    MessageToast.show(this._getText("reportBOMnull"));
                    oPanelResultado.setVisible(false);
                    return;
                }

                // busca descrição do PA
                let sDescricaoPA = "";
                let bProblemaCadastro = false;

                try {
                    const aPaRows = await this._readCollection("/ZTPE_MATERIALSet", [
                        new Filter("Codigocm", FilterOperator.EQ, sMaterial)
                    ]);

                    const sDesc = aPaRows && aPaRows[0] ? aPaRows[0].Descricaocm : null;

                    if (sDesc && sDesc.trim() !== "") {
                        sDescricaoPA = `${sMaterial} - ${sDesc}`;
                        bProblemaCadastro = false;

                        this._sDescricaoPA = sDesc;
                    } else {
                        sDescricaoPA = this._getText("cadastroNull", [sMaterial]);
                        bProblemaCadastro = true;

                        this._sDescricaoPA = "";
                    }
                } catch (oErrPA) {
                    sDescricaoPA = this._getText("cadastroNull", [sMaterial]);
                    bProblemaCadastro = true;
                    this._sDescricaoPA = "";
                    console.warn(this._getText("warnFetchPAMasterData"), oErrPA);
                }

                // filtro com apenas MP
                const aMatFilters = aBomRows.map(oItem => new Filter("Codigocm", FilterOperator.EQ, oItem.Codigomp));
                const oCombinedMatFilter = new Filter({
                    filters: aMatFilters,
                    and: false
                });

                // busca cadastro das MP
                const aMaterialRows = await this._readCollection("/ZTPE_MATERIALSet", [oCombinedMatFilter]);

                const mMapMateriais = aMaterialRows.reduce((mAcc, oMat) => {
                    mAcc[oMat.Codigocm] = oMat;
                    return mAcc;
                }, {});

                // conversão auxiliar para garantir número limpo em JS
                const fnParseNumber = (vVal) => {
                    if (vVal === null || vVal === undefined || vVal === "") return 0;
                    const nParsed = parseFloat(String(vVal).replace(",", "."));
                    return isNaN(nParsed) ? 0 : nParsed;
                };

                // preenche tabela
                const aItemsEnriched = aBomRows.map((oBomItem) => {
                    const oMat = mMapMateriais[oBomItem.Codigomp] || {};
                    return {
                        Codigomp: oBomItem.Codigomp,
                        Descricaocm: oMat.Descricaocm || this._getText("cadastroNullDesc"),
                        Quantidademp: fnParseNumber(oBomItem.Quantidademp),
                        UnidadeMedidacm: oMat.UnidadeMedidacm || ""
                    };
                });

                // atualiza tabela
                oView.getModel("bomModel").setData(aItemsEnriched);

                // atualiza o texto do titulo do painel
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
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

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
                            const sMaterialPA = this.byId("inputMaterial").getValue().trim();
                            MessageBox.warning(this._getText("msgWarningInsufficientInsumos"), {
                                title: this._getText("titleInsufficientInsumos"),
                                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                onClose: (sDialogAction) => {
                                    if (sDialogAction === MessageBox.Action.YES) {
                                        const oRouter = UIComponent.getRouterFor(this);
                                        if (oRouter) {
                                            oRouter.navTo("RouteCentralCompras", {
                                                materialPA: sMaterialPA
                                            });
                                        }
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
                this.byId("inputMaterial").setValue(sSelectedCode);

                // ja busca automaticamente
                this.onBuscar();
            }

            oEvent.getSource().getBinding("items").filter([]);
        },

        _readCollection(sPath, aFilters) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();

                if (!oModel) {
                    reject(new Error(this._getText("errorODataModelNotFound")));
                    return;
                }

                oModel.read(sPath, {
                    filters: aFilters || [],
                    success: (oData) => resolve(Array.isArray(oData && oData.results) ? oData.results : []),
                    error: (oError) => reject(oError)
                });
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
        },
        
        _extrairDetalhesErro(oError) {
            let sMensagem = "";
            let aDetails = [];

            try {
                const oResponseBody = JSON.parse(oError.responseText);
                aDetails = oResponseBody?.error?.innererror?.errordetails || [];
                sMensagem = oResponseBody?.error?.message?.value || "";

                if (!sMensagem && aDetails.length > 0) {
                    const oDetailValido = aDetails.find(d => d.message && d.code !== "/IWBEP/CX_MGW_BUSI_EXCEPTION");
                    sMensagem = oDetailValido ? oDetailValido.message : aDetails[0].message;
                }
            } catch (e) {
                sMensagem = (oError && oError.message) ? oError.message : "";
            }

            return {
                sMensagem: sMensagem,
                aDetails: aDetails
            };
        },

        _tratarErro(oError, sMensagemPadrao) {
            const oErroInfo = this._extrairDetalhesErro(oError);
            const sErrorDetails = oErroInfo.sMensagem || sMensagemPadrao;
            MessageBox.error(sErrorDetails);
        }
    });
});