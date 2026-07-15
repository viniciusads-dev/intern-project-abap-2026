sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "zpeweb/model/models",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, Device, models, JSONModel) {
    "use strict";

    return UIComponent.extend("zpeweb.Component", {

        metadata: {
            manifest: "json"
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");

            const oNavModel = new JSONModel({
                currentLocation: "",
                history: []
            });
            this.setModel(oNavModel, "navModel");

            this.getRouter().initialize();
        }
    });
});