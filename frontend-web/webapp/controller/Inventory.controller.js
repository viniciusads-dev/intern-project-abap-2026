sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], (Controller, UIComponent, MessageToast, MessageBox, JSONModel) => {
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
                // O binding já está configurado na view: items="{path: '/ZSTR_ESTOQUE_ODATASET'...}"
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
            MessageToast.show("Funcionalidade 'Registrar Movimentação' em desenvolvimento");
            
            // TODO: Implementar lógica para:
            // - Abrir Dialog de movimentação
            // - Capturar dados: Código, Quantidade, Tipo de Movimento, etc.
            // - Enviar para servidor via OData POST/PUT
            // - Atualizar tabela após sucesso
        },

        /**
         * Handler para o clique no botão "Gerar Relatório"
         * Exporta dados para Excel (em desenvolvimento)
         */
        onGenerateReport() {
            MessageToast.show("Funcionalidade 'Gerar Relatório' em desenvolvimento");
            
            // TODO: Implementar lógica para:
            // - Usar biblioteca de export (spreadsheet, etc.)
            // - Formatar dados da tabela para Excel
            // - Incluir filtros e ordenação atual
            // - Download automático do arquivo
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
                MessageToast.show(`Detalhes do material ${sMaterialCode} (em desenvolvimento)`);
                
                // TODO: Implementar navegação para:
                // - Tela de detalhes do material
                // - Histórico de movimentações
                // - Preço e custódia
                // - Fotos/Anexos do material
            }
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
