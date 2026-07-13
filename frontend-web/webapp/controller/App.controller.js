sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent"
], (Controller, UIComponent) => {
  "use strict";

  return Controller.extend("zpeweb.controller.App", {
      onInit() {
          // Inicializa o roteador quando a aplicação é carregada
          const oRouter = UIComponent.getRouterFor(this);
          oRouter.initialize();
      }
  });
});