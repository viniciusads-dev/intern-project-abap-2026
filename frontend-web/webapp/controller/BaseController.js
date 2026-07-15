sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent"
], function (Controller, UIComponent) {
    "use strict";

    return Controller.extend("zpeweb.controller.BaseController", {
        
        getRouter() {
            return UIComponent.getRouterFor(this);
        },

        updateBreadcrumbs(sCurrentLocation, aHistory) {
            const oNavModel = this.getOwnerComponent().getModel("navModel");
            if (oNavModel) {
                oNavModel.setProperty("/currentLocation", sCurrentLocation);
                oNavModel.setProperty("/history", aHistory);
            }
        },

        onGlobalNavBack(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("navModel");
            const sRoute = oContext.getProperty("route");
            
            this.getRouter().navTo(sRoute);
        }
    });
});