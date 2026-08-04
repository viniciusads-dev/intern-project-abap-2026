sap.ui.define([
    "zpeweb/lib/jspdf.umd",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (jsPdfModule, Filter, FilterOperator) {
    "use strict";

    const JsPDF = jsPdfModule && jsPdfModule.jsPDF ? jsPdfModule.jsPDF : window.jspdf && window.jspdf.jsPDF;

    if (!JsPDF) {
        throw new Error("jsPDF não foi carregado corretamente.");
    }

    // ==========================================
    // UTILITÁRIOS DE DATA E FORMATAÇÃO
    // ==========================================
    function formatDateTime(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }

    function formatDateOnly(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    function formatFileStamp(date) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }

    function getStartOfDay(date) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    function getEndOfDay(date) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    function getMovementTypeLabel(value) {
        const type = String(value || "").trim().toUpperCase();
        if (type === "E") return "E - Entrada";
        if (type === "S") return "S - Saída";
        if (type === "I") return "I - Inventário";
        return type;
    }

    function formatFilterSummary(filters) {
        const summary = [];
        if (filters.materialCode) summary.push(`Código do material: ${filters.materialCode}`);
        if (filters.movementType) summary.push(`Tipo de movimentação: ${getMovementTypeLabel(filters.movementType)}`);
        if (filters.dateFrom || filters.dateTo) {
            const from = filters.dateFrom ? formatDateOnly(filters.dateFrom) : "";
            const to = filters.dateTo ? formatDateOnly(filters.dateTo) : "";
            summary.push(`Período: ${from || "..."} até ${to || "..."}`);
        }
        return summary;
    }
    
    function formatPedFilterSummary(filters) {
        const summary = [];
        if (filters.pedido) summary.push(`Número do pedido: ${filters.pedido}`);
        if (filters.dateFrom || filters.dateTo) {
            const from = filters.dateFrom ? formatDateOnly(filters.dateFrom) : "";
            const to = filters.dateTo ? formatDateOnly(filters.dateTo) : "";
            summary.push(`Período: ${from || "..."} até ${to || "..."}`);
        }
        return summary;
    }

    // ==========================================
    // EXPORTAÇÃO: CSV
    // ==========================================
    function escapeCsv(value) {
        const sValue = value === null || value === undefined ? "" : String(value);
        return `"${sValue.replace(/"/g, '""')}"`;
    }

    function downloadCsv(rows, reportType) {
        let headers = [];
        let lines = [];

        if (reportType === "MOV") {
            headers = ["Cod. Produto", "Descrição", "Data", "Tipo", "Qtd."];
            lines.push(headers.join(";"));
            rows.forEach((row) => {
                lines.push([escapeCsv(row.code), escapeCsv(row.description), escapeCsv(row.dateText), escapeCsv(row.typeText), escapeCsv(row.quantityText)].join(";"));
            });
        } else {
            headers = ["Nº Pedido", "Data", "Cód. Mat.", "Descrição", "Qtd."];
            lines.push(headers.join(";"));
            rows.forEach((row) => {
                lines.push([escapeCsv(row.pedido), escapeCsv(row.dateText), escapeCsv(row.material), escapeCsv(row.description), escapeCsv(row.quantity)].join(";"));
            });
        }

        const csv = "\ufeff" + lines.join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const fileName = reportType === "MOV" ? "relatorio_movimentacao_" : "relatorio_pedidos_";
        link.href = url;
        link.download = `${fileName}${formatFileStamp(new Date())}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // EXPORTAÇÃO: PDF (GENÉRICO PARA MOV E PED)
    // ==========================================
    function savePdf(report, reportType) {
        const rows = Array.isArray(report && report.rows) ? report.rows : [];
        const filters = report && report.filters ? report.filters : {};
        const generatedAt = report && report.generatedAt ? new Date(report.generatedAt) : new Date();
        const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12, titleY = 14, subtitleY = 31, filterStartY = 43;
        const tableStartX = margin;
        const tableWidth = pageWidth - (margin * 2);
        
        let columns = [];
        let title = "";
        let filterSummary = [];
        
        if (reportType === "MOV") {
            title = "RELATÓRIO DE MOVIMENTAÇÕES DE ESTOQUE";
            filterSummary = formatFilterSummary(filters);
            columns = [
                { key: "code", label: "Cód. Produto", width: 26 },
                { key: "description", label: "Descrição", width: 70 },
                { key: "dateText", label: "Data", width: 25 },
                { key: "typeText", label: "Tipo", width: 44 },
                { key: "quantityText", label: "Qtd.", width: 21 }
            ];
        } else {
            title = "RELATÓRIO DE PEDIDOS DE COMPRAS";
            filterSummary = formatPedFilterSummary(filters);
            columns = [
                { key: "pedido", label: "Nº Pedido", width: 25 },
                { key: "dateText", label: "Data", width: 25 },
                { key: "material", label: "Cód. Mat.", width: 25 },
                { key: "description", label: "Descrição", width: 90 },
                { key: "quantity", label: "Qtd.", width: 21 }
            ];
        }
        
        const headerHeight = 8, lineHeight = 4.8, contentBottom = pageHeight - 16;
        const subtitle = filterSummary.length ? "RELATÓRIO FILTRADO" : "RELATÓRIO GERAL";
        let currentY = filterStartY + (filterSummary.length * 4.5) + 5;

        function drawPageHeader() {
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(title, pageWidth / 2, titleY, { align: "center" });

            doc.setFontSize(10);
            doc.text(`Data de Emissão: ${formatDateOnly(generatedAt)}`, pageWidth / 2, titleY + 5, { align: "center" });
            doc.text(`Hora: ${formatDateTime(generatedAt).split(" ")[1]}`, pageWidth / 2, titleY + 10, { align: "center" });

            doc.setFontSize(11);
            doc.text(subtitle, pageWidth / 2, subtitleY, { align: "center" });

            if (filterSummary.length) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                filterSummary.forEach((line, index) => {
                    doc.text(line, tableStartX, filterStartY + (index * 4.5));
                });
            }
            doc.setDrawColor(0, 0, 0);
            doc.line(tableStartX, currentY - 4, tableStartX + tableWidth, currentY - 4);
        }

        function drawTableHeader(yPosition) {
            let xPosition = tableStartX;
            columns.forEach((column) => {
                doc.setFillColor(235, 235, 235); 
                doc.setDrawColor(0, 0, 0);       
                doc.setTextColor(0, 0, 0);       
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.rect(xPosition, yPosition, column.width, headerHeight, "FD");
                doc.text(column.label, xPosition + 1.5, yPosition + 5.5);
                xPosition += column.width;
            });
        }

        function drawRow(row, yPosition) {
            let xPosition = tableStartX;
            doc.setDrawColor(0, 0, 0); 
            doc.setTextColor(0, 0, 0); 
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);

            const descriptionCol = columns.find(c => c.key === "description");
            const descriptionLines = doc.splitTextToSize(String(row.description || ""), descriptionCol.width - 3);
            const rowHeight = Math.max(headerHeight, descriptionLines.length * lineHeight + 2);

            columns.forEach((column) => {
                doc.rect(xPosition, yPosition, column.width, rowHeight);
                let textValue = String(row[column.key] || "");
                let textY = yPosition + 5.4;

                if (column.key === "description") {
                    doc.text(descriptionLines, xPosition + 1.5, textY);
                } else {
                    const maxWidth = column.width - 3;
                    while (doc.getTextWidth(textValue) > maxWidth && textValue.length > 0) {
                        textValue = textValue.slice(0, -1);
                    }
                    if (textValue.length < String(row[column.key] || "").length) {
                        textValue = `${textValue.slice(0, Math.max(0, textValue.length - 3))}...`;
                    }
                    doc.text(textValue, xPosition + 1.5, textY);
                }
                xPosition += column.width;
            });
            return rowHeight;
        }

        drawPageHeader();
        drawTableHeader(currentY);
        currentY += headerHeight;

        rows.forEach((row) => {
            const descriptionCol = columns.find(c => c.key === "description");
            const descriptionLines = doc.splitTextToSize(String(row.description || ""), descriptionCol.width - 3);
            const rowHeight = Math.max(headerHeight, descriptionLines.length * lineHeight + 2);

            if (currentY + rowHeight > contentBottom) {
                doc.addPage();
                currentY = filterStartY + (filterSummary.length * 4.5) + 5;
                drawPageHeader();
                drawTableHeader(currentY);
                currentY += headerHeight;
            }
            drawRow(row, currentY);
            currentY += rowHeight;
        });

        const totalPages = doc.getNumberOfPages();
        for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
            doc.setPage(pageIndex);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`Página ${pageIndex} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
        }

        const fileName = reportType === "MOV" ? "relatorio_movimentacao_" : "relatorio_pedidos_";
        doc.save(`${fileName}${formatFileStamp(generatedAt)}.pdf`);
    }

    // ==========================================
    // LOGICA ODATA E ORQUESTRADOR
    // ==========================================
    function readCollection(oModel, sPath, aFilters) {
        return new Promise((resolve, reject) => {
            oModel.read(sPath, {
                filters: aFilters || [],
                success: (oData) => resolve(Array.isArray(oData && oData.results) ? oData.results : []),
                error: () => reject(new Error("Não foi possível ler os dados do SAP."))
            });
        });
    }

    // --- MONTAGEM MOVIMENTAÇÃO ---
    function buildMovementFilters(mExport) {
        const aFilters = [];
        const sMaterialCode = String(mExport.Codigom || "").trim();
        const sMovementType = String(mExport.Tipol || "").trim();

        if (sMaterialCode) aFilters.push(new Filter("Codigom", FilterOperator.EQ, sMaterialCode));
        if (sMovementType) aFilters.push(new Filter("Tipol", FilterOperator.EQ, sMovementType));
        if (mExport.dateFrom) aFilters.push(new Filter("Datal", FilterOperator.GE, getStartOfDay(mExport.dateFrom)));
        if (mExport.dateTo) aFilters.push(new Filter("Datal", FilterOperator.LE, getEndOfDay(mExport.dateTo)));

        return aFilters;
    }

    function buildMovementRows(aMovementRows, aMaterials) {
        const mStockByCode = aMaterials.reduce((acc, row) => {
            acc[row.Codigocm] = row;
            return acc;
        }, {});

        return aMovementRows.map((oMovement) => {
            const oStock = mStockByCode[oMovement.Codigom] || {};
            const parsedDate = oMovement.Datal ? new Date(oMovement.Datal) : new Date(0);
            return {
                code: oMovement.Codigom || "",
                description: oStock.Descricaocm || "",
                date: parsedDate,
                dateText: formatDateOnly(parsedDate),
                typeText: getMovementTypeLabel(oMovement.Tipol),
                quantityText: String(oMovement.Quantidadel || "0").replace(/^0+/, "") || "0"
            };
        }).sort((a, b) => b.date - a.date);
    }

    // --- MONTAGEM PEDIDOS ---
    function buildPedidoFilters(mExport) {
        const aFilters = [];
        const sPedido = String(mExport.Numeropedido || "").trim();

        if (sPedido) aFilters.push(new Filter("Numeropedido", FilterOperator.EQ, sPedido));
        if (mExport.dateFrom) aFilters.push(new Filter("Datap", FilterOperator.GE, getStartOfDay(mExport.dateFrom)));
        if (mExport.dateTo) aFilters.push(new Filter("Datap", FilterOperator.LE, getEndOfDay(mExport.dateTo)));

        return aFilters;
    }

    function buildPedidoRows(aHeaders, aItems, aMaterials) {
        // Dicionário de Materiais para achar descrição rápida
        const mMaterials = aMaterials.reduce((acc, m) => {
            acc[m.Codigocm] = m.Descricaocm;
            return acc;
        }, {});

        // Agrupa os itens por Número do Pedido
        const mItemsByPed = aItems.reduce((acc, it) => {
            if (!acc[it.Numeropedido]) acc[it.Numeropedido] = [];
            acc[it.Numeropedido].push(it);
            return acc;
        }, {});

        const rows = [];
        
        // Cruza os dados
        aHeaders.forEach(h => {
            const items = mItemsByPed[h.Numeropedido] || [];
            const parsedDate = h.Datap ? new Date(h.Datap) : new Date(0);
            
            if (items.length === 0) {
                // Pedido Vazio (Só pra não sumir do relatório)
                rows.push({
                    pedido: h.Numeropedido,
                    dateText: formatDateOnly(parsedDate),
                    date: parsedDate,
                    material: "-",
                    description: "Sem itens",
                    quantity: "0"
                });
            } else {
                // Cria uma linha para cada item dentro do pedido
                items.forEach(it => {
                    rows.push({
                        pedido: h.Numeropedido,
                        dateText: formatDateOnly(parsedDate),
                        date: parsedDate,
                        material: it.Codigomp,
                        description: mMaterials[it.Codigomp] || "",
                        quantity: String(it.Quantidademp || "0").replace(/^0+/, "") || "0"
                    });
                });
            }
        });

        return rows.sort((a, b) => b.date - a.date || b.pedido.localeCompare(a.pedido));
    }

    // --- ORQUESTRADOR CENTRAL ---
    async function executeExport(oModel, mExport) {
        if (!oModel) throw new Error("Modelo de dados não encontrado para exportação.");

        // Fallback para manter a compatibilidade com a tela de Inventário
        const reportType = mExport.reportType || "MOV"; 
        
        let aReportRows = [];
        let filterConfig = {};

        if (reportType === "MOV") {
            const [aMaterials, aMovementRows] = await Promise.all([
                readCollection(oModel, "/ZTPE_MATERIALSet"),
                readCollection(oModel, "/ZTPE_LOG_MOVSet", buildMovementFilters(mExport))
            ]);
            aReportRows = buildMovementRows(aMovementRows, aMaterials);
            
            filterConfig = {
                materialCode: mExport.Codigom,
                movementType: mExport.Tipol,
                dateFrom: mExport.dateFrom,
                dateTo: mExport.dateTo
            };

        } else if (reportType === "PED") {
            // Busca os Cabeçalhos (filtrados), Todos os Itens e Todos os Materiais
            const [aHeaders, aItems, aMaterials] = await Promise.all([
                readCollection(oModel, "/ZTPE_PED_CABSet", buildPedidoFilters(mExport)),
                readCollection(oModel, "/ZTPE_PED_ITEMSet"),
                readCollection(oModel, "/ZTPE_MATERIALSet")
            ]);
            aReportRows = buildPedidoRows(aHeaders, aItems, aMaterials);
            
            filterConfig = {
                pedido: mExport.Numeropedido,
                dateFrom: mExport.dateFrom,
                dateTo: mExport.dateTo
            };
        }

        if (!aReportRows.length) {
            throw new Error("Nenhum registro encontrado para os filtros informados.");
        }

        if (String(mExport.format || "PDF").toUpperCase() === "CSV") {
            downloadCsv(aReportRows, reportType);
            return "CSV";
        } else {
            savePdf({
                rows: aReportRows,
                filters: filterConfig,
                generatedAt: new Date()
            }, reportType);
            return "PDF";
        }
    }

    return {
        executeExport: executeExport
    };
});