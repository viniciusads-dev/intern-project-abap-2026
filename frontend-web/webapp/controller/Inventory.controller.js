sap.ui.define([
    "zpeweb/controller/BaseController",
    "sap/ui/core/UIComponent",
    "sap/ui/core/Item",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/DatePicker",
    "sap/m/Input",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Label",
    "sap/m/Select",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/TextArea",
    "sap/m/VBox",
    "sap/ui/model/json/JSONModel",
    "zpeweb/util/reportGenerator",
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/Fragment" // <-- Importado para podermos chamar o Modal XML
], function (
    BaseController, 
    UIComponent, 
    Item, 
    Button, 
    Dialog, 
    DatePicker, 
    Input, 
    MessageToast, 
    MessageBox, 
    Label, 
    Select, 
    Filter, 
    FilterOperator, 
    TextArea, 
    VBox, 
    JSONModel, 
    ReportGenerator,
    DateFormat,
    Fragment // <-- Argumento do Fragment
) {
    "use strict";

    return BaseController.extend("zpeweb.controller.Inventory", {
        
        onInit() {
            this.getRouter().attachRouteMatched(this.onRouteMatched, this);
            this._initLocalModel();
            this.applySavedTheme();
        },

        onRouteMatched(oEvent) {
            this.updateBreadcrumbs("Gestão de Estoque", [
                { title: "Cockpit", route: "RouteCockpit" }
            ]);
            
            this._loadInventoryData();
        },

        onExit() {
            if (this._oMovementDialog) {
                this._oMovementDialog.destroy();
                this._oMovementDialog = null;
            }
        },

        _initLocalModel() {
            const oLocalModel = new JSONModel({
                count: 0,
                lastUpdate: new Date()
            });

            this.getView().setModel(oLocalModel, "inventoryModel");
        },

        _loadInventoryData() {
            const oModel = this.getView().getModel();
            const oTable = this.byId("inventoryTable");

            if (oModel && oTable) {
                oTable.getBinding("items").attachDataReceived(this.onDataReceived, this);
            }
        },

        onDataReceived(oEvent) {
            const oData = oEvent.getParameter("data");
            const iCount = oData.results ? oData.results.length : 0;

            const oLocalModel = this.getView().getModel("inventoryModel");
            if (oLocalModel) {
                oLocalModel.setProperty("/count", iCount);
            }
        },

        onNavBack() {
            this.getRouter().navTo("RouteCockpit");
        },

        // ==============================================================
        // MANTIDO: LÓGICA DO DIALOG DE MOVIMENTAÇÃO (FEITO EM JAVASCRIPT)
        // Dica: No futuro, você pode transformar esse modal em XML também!
        // ==============================================================
        onRegisterMovement() {
            if (!this._oMovementDialog) {
                const oMovementModel = new JSONModel({
                    Codigom: "",
                    Quantidadel: "",
                    Tipol: "E"
                });

                const oMaterialInput = new Input({
                    width: "80%",
                    placeholder: "Ex.: MAT001",
                    value: "{movement>/Codigom}"
                });

                const oQuantityInput = new Input({
                    width: "80%",
                    placeholder: "Ex.: 25",
                    type: "Number",
                    value: "{movement>/Quantidadel}"
                });

                const oMovementTypeSelect = new Select({
                    width: "80%",
                    selectedKey: "{movement>/Tipol}",
                    items: [
                        new Item({ key: "E", text: "Entrada" }),
                        new Item({ key: "S", text: "Saída" }),
                        new Item({ key: "I", text: "Inventário" })
                    ]
                });

                const oForm = new VBox({
                    width: "100%",
                    items: [
                        new Label({ text: "Código do material", labelFor: oMaterialInput }),
                        oMaterialInput,
                        new Label({ text: "Quantidade", labelFor: oQuantityInput }),
                        oQuantityInput,
                        new Label({ text: "Tipo de movimentação", labelFor: oMovementTypeSelect }),
                        oMovementTypeSelect
                    ]
                }).addStyleClass("sapUiSmallMargin");

                this._oMovementDialog = new Dialog({
                    title: "Registrar Movimentação",
                    contentWidth: "auto",
                    contentHeight: "auto",
                    scrollContainer: false, 
                    draggable: true,
                    resizable: true,
                    stretchOnPhone: true,
                    content: [
                        new sap.m.ScrollContainer({
                            width: "100%",
                            height: "100%",
                            horizontal: false, 
                            vertical: true, 
                            content: [oForm]
                        })
                    ],
                    beginButton: new Button({
                        text: "Salvar",
                        type: "Emphasized",
                        press: () => this._handleMovementSave()
                    }),
                    endButton: new Button({
                        text: "Cancelar",
                        press: () => this._oMovementDialog.close()
                    })
                });

                this._oMovementDialog.setModel(oMovementModel, "movement");
                this.getView().addDependent(this._oMovementDialog);
            }

            this._oMovementDialog.open();
        },

        _handleMovementSave() {
            const oView = this.getView();
            const oMovementModel = this._oMovementDialog.getModel("movement");
            const oData = oMovementModel.getData();
            
            const sMaterialCode = String(oData.Codigom || "").trim();
            const sQuantity = String(oData.Quantidadel || "").trim();

            if (!sMaterialCode || !sQuantity) {
                MessageBox.warning("Preencha o código do material e a quantidade.");
                return;
            }

            const iQuantity = Number(sQuantity);
            if (Number.isNaN(iQuantity) || iQuantity <= 0) {
                MessageBox.warning("Informe uma quantidade válida maior que zero.");
                return;
            }

            const oPayload = {
                Codigom: sMaterialCode,
                Quantidadem: sQuantity,
                Tipol: oData.Tipol
            };

            const oODataModel = oView.getModel();

            oView.setBusy(true);

            const sPath = oODataModel.createKey("/ZSTR_ESTOQUE_ODATASet", {
                Codigom: sMaterialCode
            });

            oODataModel.update(sPath, oPayload, {
                success: () => {
                    oView.setBusy(false);
                    MessageToast.show("Movimentação salva com sucesso!");
                    oView.getModel("inventoryModel").setProperty("/lastUpdate", new Date());
                    
                    this._oMovementDialog.close();
                    oMovementModel.setData({
                        Codigom: "",
                        Quantidadel: "",
                        Tipol: "E"
                    });

                    const oTable = this.byId("inventoryTable");
                    if (oTable && oTable.getBinding("items")) {
                        oTable.getBinding("items").refresh();
                    }
                },
                error: (oError) => {
                    oView.setBusy(false);
                    let sErrorMessage = "Erro desconhecido ao salvar no SAP.";
                    try {
                        const oParsedError = JSON.parse(oError.responseText);
                        sErrorMessage = oParsedError.error.message.value;
                    } catch (e) {
                        try {
                            const oParser = new DOMParser();
                            const oXmlDoc = oParser.parseFromString(oError.responseText, "text/xml");
                            const oMessageNode = oXmlDoc.getElementsByTagName("message")[0];
                            
                            if (oMessageNode) {
                                sErrorMessage = oMessageNode.textContent;
                            } else {
                                sErrorMessage = `Erro no servidor: ${oError.statusCode} - ${oError.statusText}`;
                            }
                        } catch (xmlError) {
                            if (oError.statusCode) {
                                sErrorMessage = `Erro de comunicação (${oError.statusCode}): ${oError.statusText || "Internal Server Error"}`;
                            } else {
                                sErrorMessage = oError.message || "Erro de conexão com o servidor SAP. Verifique sua VPN.";
                            }
                        }
                    }
                    MessageBox.error(sErrorMessage);
                }
            });
        },

        // ==============================================================
        // NOVA LÓGICA DE EXPORTAÇÃO REFATORADA
        // ==============================================================
        onGenerateReport() {
            const oView = this.getView();
            
            if (!this._pExportDialog) {
                this._pExportDialog = Fragment.load({
                    id: oView.getId(),
                    name: "zpeweb.view.fragments.ExportDialog", // Caminho do seu fragmento XML
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pExportDialog.then(function(oDialog) {
                const oExportModel = new JSONModel({
                    format: "PDF",
                    Codigom: "",
                    Tipol: "",
                    dateFrom: null,
                    dateTo: null
                });
                oDialog.setModel(oExportModel, "export");
                oDialog.open();
            });
        },

        onCancelExport() {
            this.byId("dialogExport").close();
        },

        onConfirmExport() {
            const oDialog = this.byId("dialogExport");
            const oExportModel = oDialog.getModel("export");
            const mExport = oExportModel.getData();

            if (mExport.dateFrom && mExport.dateTo && mExport.dateFrom > mExport.dateTo) {
                MessageBox.warning("A data inicial não pode ser maior que a data final.");
                return;
            }

            oDialog.close();
            this.getView().setBusy(true);

            // Chama a função central do reportGenerator.js
            ReportGenerator.executeExport(this.getView().getModel(), mExport)
                .then((sFormat) => {
                    MessageToast.show(`Relatório ${sFormat} gerado com sucesso!`);
                    this.getView().getModel("inventoryModel").setProperty("/lastUpdate", new Date());
                })
                .catch((oError) => {
                    MessageBox.error(oError.message || "Não foi possível gerar o relatório.");
                })
                .finally(() => {
                    this.getView().setBusy(false);
                });
        },

        // ==============================================================
        // LÓGICAS DA TABELA PRINCIPAL DE ESTOQUE
        // ==============================================================
        onItemPress(oEvent) {
            const oListItem = oEvent.getSource();
            const oContext = oListItem.getBindingContext();

            if (oContext) {
                const sMaterialCode = oContext.getProperty("Codigom");
                const sDescription = oContext.getProperty("Descricaocm");
                const sQuantity = oContext.getProperty("Quantidadem");
                const sUnit = oContext.getProperty("UnidadeMedidacm");
                const sType = this.formatMaterialType(oContext.getProperty("Tipocm"));

                MessageBox.information(
                    [
                        `Material: ${sMaterialCode}`,
                        `Descrição: ${sDescription}`,
                        `Quantidade: ${sQuantity} ${sUnit}`,
                        `Tipo: ${sType}`
                    ].join("\n")
                );
            }
        },

        formatMaterialType(vType) {
            const sType = String(vType || "").trim();
            if (sType === "1" || sType.toUpperCase() === "MATERIA_PRIMA") {
                return "1 - Matéria Prima";
            }
            if (sType === "2" || sType.toUpperCase() === "PRODUTO_ACABADO") {
                return "2 - Produto Acabado";
            }
            return sType;
        },

        formatBadgeCount(iCount) {
            return iCount > 0 ? `${iCount} ${this.getView().getModel("i18n").getResourceBundle().getText("badgeRecords")}` : "";
        },

        formatBadgeVisible(iCount) {
            return iCount > 0;
        },

        formatLastUpdate(dLastUpdate) {
            if (!dLastUpdate) {
                return "";
            }
            const oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy HH:mm:ss"
            });
            return "Última atualização: " + oDateFormat.format(new Date(dLastUpdate));
        },

        getRouter() {
            return UIComponent.getRouterFor(this);
        }
    });
});