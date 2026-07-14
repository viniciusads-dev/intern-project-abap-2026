sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox"
], (Controller, UIComponent, MessageBox) => {
    "use strict";

    return Controller.extend("zpeweb.controller.Cockpit", {
        onInit() {
            this.getRouter().attachRouteMatched(this.onRouteMatched, this);
        },

        onRouteMatched() {
            // Lógica executada quando a rota do cockpit é correspondida
            // Pode ser usada para buscar dados iniciais ou atualizar o estado
        },

        /**
         * Trata o clique nos cards do cockpit
         * @param {sap.ui.base.Event} oEvent - Evento do clique
         */
        onCardPress(oEvent) {
            const oSource = oEvent.getSource();
            const sRoute = oSource.data("route");
            const mRouteMap = {
                inventory: "RouteInventory"
            };
            const sRouteName = mRouteMap[sRoute];

            if (sRouteName) {
                this.getRouter().navTo(sRouteName);
            } else {
                MessageBox.information("Funcionalidade em desenvolvimento");
            }
        },

        /**
         * Retorna a instância do router
         * @returns {sap.m.routing.Router} - Instância do router
         */
        getRouter() {
            return UIComponent.getRouterFor(this);
        }
    });
});
