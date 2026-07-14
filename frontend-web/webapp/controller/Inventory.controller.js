sap.ui.define([
    "sap/ui/core/mvc/Controller",
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
    "zpeweb/util/reportGenerator"
], (Controller, UIComponent, Item, Button, Dialog, DatePicker, Input, MessageToast, MessageBox, Label, Select, Filter, FilterOperator, TextArea, VBox, JSONModel, ReportGenerator) => {
    "use strict";

    return Controller.extend("zpeweb.controller.Inventory", {
        
        /**
         * Função de inicialização do controller
         * Executada quando a view é carregada
         */
        onInit() {
            // Attach route matched para interceptar navegação
            this.getRouter().attachRouteMatched(this.onRouteMatched, this);
            
            // Inicializa modelo local para dados não-OData
            this._initLocalModel();
        },

        onExit() {
            if (this._oMovementDialog) {
                this._oMovementDialog.destroy();
                this._oMovementDialog = null;
            }

            if (this._oExportDialog) {
                this._oExportDialog.destroy();
                this._oExportDialog = null;
            }
        },

        /**
         * Inicializa o modelo local para dados internos da view
         * @private
         */
        _initLocalModel() {
            const oLocalModel = new JSONModel({
                count: 0,
                lastUpdate: new Date()
            });
            
            this.getView().setModel(oLocalModel, "inventoryModel");
        },

        /**
         * Handler para quando a rota é correspondida
         * Carrega dados da tabela de estoque
         * @param {sap.ui.base.Event} oEvent - Evento de correspondência de rota
         */
        onRouteMatched(oEvent) {
            // Aqui você pode carregar dados específicos se necessário
            // Por exemplo: buscar registros iniciais, filtros, etc.
            this._loadInventoryData();
        },

        /**
         * Carrega dados de estoque do serviço OData
         * @private
         */
        _loadInventoryData() {
            const oModel = this.getView().getModel();
            const oTable = this.byId("inventoryTable");

            if (oModel && oTable) {
                // Usa o binding automático da tabela
                // O binding já está configurado na view: items="{path: '/ZSTR_ESTOQUE_ODATASet'...}"
                // Aqui você pode adicionar lógica de filtro ou sort inicial se necessário
                
                oTable.getBinding("items").attachDataReceived(this.onDataReceived, this);
            }
        },

        /**
         * Handler para quando os dados são recebidos do servidor OData
         * Atualiza a contagem de registros
         * @private
         */
        onDataReceived(oEvent) {
            const oData = oEvent.getParameter("data");
            const iCount = oData.results ? oData.results.length : 0;
            
            const oLocalModel = this.getView().getModel("inventoryModel");
            if (oLocalModel) {
                oLocalModel.setProperty("/count", iCount);
            }
        },

        /**
         * Handler para navegação de retorno
         * Volta para o cockpit usando o router
         */
        onNavBack() {
            this.getRouter().navTo("RouteCockpit");
        },

        /**
         * Handler para o clique no botão "Registrar Movimentação"
         * Abre dialog ou navega para tela de movimentação (em desenvolvimento)
         */
        onRegisterMovement() {
            if (!this._oMovementDialog) {
                const oMovementModel = new JSONModel({
                    materialCode: "",
                    quantity: "",
                    movementType: "Entrada",
                    notes: ""
                });

                const oMaterialInput = new Input({
                    placeholder: "Ex.: MAT001",
                    value: "{movement>/materialCode}"
                });

                const oQuantityInput = new Input({
                    placeholder: "Ex.: 25",
                    type: "Number",
                    value: "{movement>/quantity}"
                });

                const oMovementTypeSelect = new Select({
                    selectedKey: "{movement>/movementType}",
                    items: [
                        new Item({ key: "Entrada", text: "Entrada" }),
                        new Item({ key: "Saída", text: "Saída" }),
                        new Item({ key: "Ajuste", text: "Ajuste" })
                    ]
                });

                const oNotesInput = new TextArea({
                    rows: 4,
                    width: "100%",
                    placeholder: "Observações opcionais",
                    value: "{movement>/notes}"
                });

                const oForm = new VBox({
                    width: "100%",
                    items: [
                        new Label({ text: "Código do material", labelFor: oMaterialInput }),
                        oMaterialInput,
                        new Label({ text: "Quantidade", labelFor: oQuantityInput }),
                        oQuantityInput,
                        new Label({ text: "Tipo de movimentação", labelFor: oMovementTypeSelect }),
                        oMovementTypeSelect,
                        new Label({ text: "Observações", labelFor: oNotesInput }),
                        oNotesInput
                    ]
                }).addStyleClass("sapUiSmallMargin");

                this._oMovementDialog = new Dialog({
                    title: "Registrar Movimentação",
                    contentWidth: "32rem",
                    contentHeight: "auto",
                    draggable: true,
                    resizable: true,
                    stretchOnPhone: true,
                    content: [oForm],
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

        /**
         * Handler para o clique no botão "Gerar Relatório"
         * Abre o diálogo para escolher formato e filtros da exportação
         */
        onGenerateReport() {
            this._openExportDialog();
        },

        _openExportDialog() {
            if (!this._oExportDialog) {
                const oExportModel = new JSONModel({
                    format: "PDF",
                    materialCode: "",
                    movementType: "",
                    dateFrom: null,
                    dateTo: null
                });

                const oFormatSelect = new Select({
                    selectedKey: "{export>/format}",
                    items: [
                        new Item({ key: "PDF", text: "PDF" }),
                        new Item({ key: "CSV", text: "CSV" })
                    ]
                });

                const oMaterialInput = new Input({
                    placeholder: "Ex.: 0024",
                    value: "{export>/materialCode}"
                });

                const oMovementTypeSelect = new Select({
                    selectedKey: "{export>/movementType}",
                    items: [
                        new Item({ key: "", text: "Todos" }),
                        new Item({ key: "E", text: "E - Entrada" }),
                        new Item({ key: "S", text: "S - Saída" }),
                        new Item({ key: "I", text: "I - Inventário" })
                    ]
                });

                const oDateFromPicker = new DatePicker({
                    width: "100%",
                    valueFormat: "yyyy-MM-dd",
                    displayFormat: "dd/MM/yyyy",
                    dateValue: "{export>/dateFrom}"
                });

                const oDateToPicker = new DatePicker({
                    width: "100%",
                    valueFormat: "yyyy-MM-dd",
                    displayFormat: "dd/MM/yyyy",
                    dateValue: "{export>/dateTo}"
                });

                const oContent = new VBox({
                    width: "100%",
                    items: [
                        new Label({ text: "Formato de exportação" }),
                        oFormatSelect,
                        new Label({ text: "Código do material" }),
                        oMaterialInput,
                        new Label({ text: "Tipo de movimentação" }),
                        oMovementTypeSelect,
                        new Label({ text: "Data inicial" }),
                        oDateFromPicker,
                        new Label({ text: "Data final" }),
                        oDateToPicker
                    ]
                }).addStyleClass("sapUiSmallMargin");

                this._oExportDialog = new Dialog({
                    title: "Exportar relatório",
                    contentWidth: "34rem",
                    stretchOnPhone: true,
                    content: [oContent],
                    beginButton: new Button({
                        text: "Exportar",
                        type: "Emphasized",
                        press: () => this._handleExportConfirm()
                    }),
                    endButton: new Button({
                        text: "Cancelar",
                        press: () => this._oExportDialog.close()
                    })
                });

                this._oExportDialog.setModel(oExportModel, "export");
                this.getView().addDependent(this._oExportDialog);
            }

            this._oExportDialog.open();
        },

        _handleExportConfirm() {
            const oExportModel = this._oExportDialog.getModel("export");
            const mExport = oExportModel.getData();

            if (mExport.dateFrom && mExport.dateTo && mExport.dateFrom > mExport.dateTo) {
                MessageBox.warning("A data inicial não pode ser maior que a data final.");
                return;
            }

            this._oExportDialog.close();
            this._executeReportExport(mExport).catch((oError) => {
                MessageBox.error(oError.message || "Não foi possível gerar o relatório.");
            });
        },

        async _executeReportExport(mExport) {
            const oView = this.getView();
            const oModel = oView.getModel();

            if (!oModel) {
                throw new Error("Modelo de dados não encontrado para exportação.");
            }

            oView.setBusy(true);

            try {
                const [aStockRows, aMovementRows] = await Promise.all([
                    this._readCollection("/ZSTR_ESTOQUE_ODATASet"),
                    this._readCollection("/ZTPE_LOG_MOVSet", this._buildMovementFilters(mExport))
                ]);

                const mStockByCode = aStockRows.reduce((mAcc, oRow) => {
                    mAcc[oRow.Codigom] = oRow;
                    return mAcc;
                }, {});

                const aReportRows = this._buildReportRows(aMovementRows, mStockByCode, mExport);

                if (!aReportRows.length) {
                    MessageBox.information("Nenhum registro encontrado para os filtros informados.");
                    return;
                }

                if (String(mExport.format || "PDF").toUpperCase() === "CSV") {
                    this._downloadCsv(aReportRows);
                    MessageToast.show("Relatório CSV exportado com sucesso.");
                } else {
                    ReportGenerator.saveMovementReportPdf({
                        rows: aReportRows,
                        filters: mExport
                    });
                    MessageToast.show("Relatório PDF exportado com sucesso.");
                }

                oView.getModel("inventoryModel").setProperty("/lastUpdate", new Date());
            } finally {
                oView.setBusy(false);
            }
        },

        _readCollection(sPath, aFilters) {
            return new Promise((resolve, reject) => {
                const oModel = this.getView().getModel();

                oModel.read(sPath, {
                    filters: aFilters || [],
                    success: (oData) => resolve(Array.isArray(oData && oData.results) ? oData.results : []),
                    error: () => reject(new Error("Não foi possível ler os dados do relatório."))
                });
            });
        },

        _buildMovementFilters(mExport) {
            const aFilters = [];
            const sMaterialCode = String(mExport.materialCode || "").trim();
            const sMovementType = String(mExport.movementType || "").trim();

            if (sMaterialCode) {
                aFilters.push(new Filter("Codigom", FilterOperator.EQ, sMaterialCode));
            }

            if (sMovementType) {
                aFilters.push(new Filter("Tipol", FilterOperator.EQ, sMovementType));
            }

            if (mExport.dateFrom) {
                aFilters.push(new Filter("Datal", FilterOperator.GE, this._getStartOfDay(mExport.dateFrom)));
            }

            if (mExport.dateTo) {
                aFilters.push(new Filter("Datal", FilterOperator.LE, this._getEndOfDay(mExport.dateTo)));
            }

            return aFilters;
        },

        _buildReportRows(aMovementRows, mStockByCode) {
            return aMovementRows
                .map((oMovement) => {
                    const oStock = mStockByCode[oMovement.Codigom] || {};
                    return {
                        code: oMovement.Codigom || "",
                        description: oStock.Descricaocm || "",
                        date: this._parseODataDate(oMovement.Datal),
                        dateText: this._formatReportDate(oMovement.Datal),
                        typeText: this._formatMovementTypeLabel(oMovement.Tipol),
                        quantityText: this._formatQuantity(oMovement.Quantidadel)
                    };
                })
                .sort((a, b) => b.date - a.date);
        },

        _getStartOfDay(oDate) {
            const oResult = new Date(oDate);
            oResult.setHours(0, 0, 0, 0);
            return oResult;
        },

        _getEndOfDay(oDate) {
            const oResult = new Date(oDate);
            oResult.setHours(23, 59, 59, 999);
            return oResult;
        },

        _parseODataDate(vDate) {
            return vDate ? new Date(vDate) : new Date(0);
        },

        _formatReportDate(vDate) {
            if (!vDate) {
                return "";
            }

            const oDate = new Date(vDate);
            const iDay = String(oDate.getDate()).padStart(2, "0");
            const iMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const iYear = oDate.getFullYear();

            return `${iDay}.${iMonth}.${iYear}`;
        },

        _formatMovementTypeLabel(vType) {
            const sType = String(vType || "").trim().toUpperCase();

            if (sType === "E") {
                return "E - Entrada";
            }

            if (sType === "S") {
                return "S - Saída";
            }

            if (sType === "I") {
                return "I - Inventário";
            }

            return sType;
        },

        _formatQuantity(vValue) {
            const sValue = String(vValue || "0").replace(/^0+/, "");
            return sValue || "0";
        },

        _downloadCsv(aRows) {
            const aHeaders = ["Cod. Produto", "Descrição", "Data", "Tipo", "Qtd."];
            const aLines = [aHeaders.join(";")];

            aRows.forEach((oRow) => {
                aLines.push([
                    this._escapeCsv(oRow.code),
                    this._escapeCsv(oRow.description),
                    this._escapeCsv(oRow.dateText),
                    this._escapeCsv(oRow.typeText),
                    this._escapeCsv(oRow.quantityText)
                ].join(";"));
            });

            const sCsv = "\ufeff" + aLines.join("\r\n");
            const oBlob = new Blob([sCsv], { type: "text/csv;charset=utf-8;" });
            const sUrl = URL.createObjectURL(oBlob);
            const oLink = document.createElement("a");

            oLink.href = sUrl;
            oLink.download = `relatorio_movimentacao_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
            document.body.appendChild(oLink);
            oLink.click();
            document.body.removeChild(oLink);
            URL.revokeObjectURL(sUrl);
        },

        /**
         * Handler para clique em um item da tabela
         * Pode navegar para detalhes do material (em desenvolvimento)
         * @param {sap.ui.base.Event} oEvent - Evento do clique
         */
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

        _handleMovementSave() {
            const oMovementModel = this._oMovementDialog.getModel("movement");
            const oData = oMovementModel.getData();
            const sMaterialCode = String(oData.materialCode || "").trim();
            const sQuantity = String(oData.quantity || "").trim();

            if (!sMaterialCode || !sQuantity) {
                MessageBox.warning("Preencha o código do material e a quantidade.");
                return;
            }

            const iQuantity = Number(sQuantity);

            if (Number.isNaN(iQuantity) || iQuantity <= 0) {
                MessageBox.warning("Informe uma quantidade válida maior que zero.");
                return;
            }

            const sMessage = `${oData.movementType} registrada para ${sMaterialCode} com quantidade ${iQuantity}.`;

            this.getView().getModel("inventoryModel").setProperty("/lastUpdate", new Date());
            MessageToast.show(sMessage);
            this._oMovementDialog.close();
            oMovementModel.setData({
                materialCode: "",
                quantity: "",
                movementType: "Entrada",
                notes: ""
            });
        },

        _escapeCsv(vValue) {
            const sValue = vValue === null || vValue === undefined ? "" : String(vValue);
            return `"${sValue.replace(/"/g, '""')}"`;
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

        /**
         * Formata a contagem de registros para exibição no badge
         * @param {number} iCount - Quantidade de registros
         * @returns {string} - Texto formatado
         */
        formatBadgeCount(iCount) {
            return iCount > 0 ? `${iCount} ${this.getView().getModel("i18n").getResourceBundle().getText("badgeRecords")}` : "";
        },

        /**
         * Determina se o badge deve ser visível
         * @param {number} iCount - Quantidade de registros
         * @returns {boolean} - True se deve exibir o badge
         */
        formatBadgeVisible(iCount) {
            return iCount > 0;
        },

        /**
         * Formata a data da última atualização
         * @param {Date} dLastUpdate - Data da última atualização
         * @returns {string} - Data formatada
         */
        formatLastUpdate(dLastUpdate) {
            if (!dLastUpdate) {
                return "";
            }
            
            const oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy HH:mm:ss"
            });
            
            return "Última atualização: " + oDateFormat.format(new Date(dLastUpdate));
        },

        /**
         * Retorna a instância do router da aplicação
         * @returns {sap.m.routing.Router} - Router da aplicação
         */
        getRouter() {
            return UIComponent.getRouterFor(this);
        }
    });
});
