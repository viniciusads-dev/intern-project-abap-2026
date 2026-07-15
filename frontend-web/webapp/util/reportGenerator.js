sap.ui.define([
    "zpeweb/lib/jspdf.umd"
], function (jsPdfModule) {
    "use strict";

    const JsPDF = jsPdfModule && jsPdfModule.jsPDF ? jsPdfModule.jsPDF : window.jspdf && window.jspdf.jsPDF;

    if (!JsPDF) {
        throw new Error("jsPDF nÃ£o foi carregado corretamente.");
    }

    function formatDateTime(value) {
        const date = value instanceof Date ? value : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

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

        if (Number.isNaN(date.getTime())) {
            return "";
        }

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

    function getMovementTypeLabel(value) {
        const type = String(value || "").trim().toUpperCase();

        if (type === "E") {
            return "E - Entrada";
        }

        if (type === "S") {
            return "S - SaÃ­da";
        }

        if (type === "I") {
            return "I - InventÃ¡rio";
        }

        return type;
    }

    function formatFilterSummary(filters) {
        const summary = [];

        if (filters.materialCode) {
            summary.push(`Código do material: ${filters.materialCode}`);
        }

        if (filters.movementType) {
            summary.push(`Tipo de movimentação: ${getMovementTypeLabel(filters.movementType)}`);
        }

        if (filters.dateFrom || filters.dateTo) {
            const from = filters.dateFrom ? formatDateOnly(filters.dateFrom) : "";
            const to = filters.dateTo ? formatDateOnly(filters.dateTo) : "";
            summary.push(`Período: ${from || "..."} até ${to || "..."}`);
        }

        return summary;
    }

    function saveMovementReportPdf(report) {
        const rows = Array.isArray(report && report.rows) ? report.rows : [];
        const filters = report && report.filters ? report.filters : {};
        const generatedAt = report && report.generatedAt ? new Date(report.generatedAt) : new Date();
        const doc = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const titleY = 14;
        const subtitleY = 31;
        const filterStartY = 43;
        const tableStartX = margin;
        const tableWidth = pageWidth - (margin * 2);
        const columns = [
            { key: "code", label: "Cód. Produto", width: 26 },
            { key: "description", label: "Descrição", width: 70 },
            { key: "dateText", label: "Data", width: 25 },
            { key: "typeText", label: "Tipo", width: 44 },
            { key: "quantityText", label: "Qtd.", width: 21 }
        ];
        const headerHeight = 8;
        const lineHeight = 4.8;
        const contentBottom = pageHeight - 16;
        const filterSummary = formatFilterSummary(filters);
        const subtitle = filterSummary.length ? "RELATÓRIO DE MOVIMENTAÇÃO (FILTRADO)" : "RELATÓRIO DE MOVIMENTAÇÃO GERAL (TODOS OS PRODUTOS)";
        let currentY = filterStartY + (filterSummary.length * 4.5) + 5;

        function drawPageHeader() {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("RELATÓRIO DE MOVIMENTAÇÕES DE ESTOQUE", pageWidth / 2, titleY, { align: "center" });

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

            doc.setDrawColor(0);
            doc.line(tableStartX, currentY - 4, tableStartX + tableWidth, currentY - 4);
        }

        function drawTableHeader(yPosition) {
            let xPosition = tableStartX;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setFillColor(235, 235, 235);

            columns.forEach((column) => {
                doc.rect(xPosition, yPosition, column.width, headerHeight, "FD");
                doc.text(column.label, xPosition + 1.5, yPosition + 5.5);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setFillColor(235, 235, 235);
                xPosition += column.width;
            });
        }

        function drawRow(row, yPosition) {
            let xPosition = tableStartX;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);

            const descriptionLines = doc.splitTextToSize(String(row.description || ""), columns[1].width - 3);
            const descriptionHeight = Math.max(headerHeight, descriptionLines.length * lineHeight + 2);
            const rowHeight = descriptionHeight;

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
            const preparedRow = {
                code: row.code,
                description: row.description,
                dateText: row.dateText,
                typeText: row.typeText,
                quantityText: row.quantityText
            };

            const descriptionWidth = columns[1].width - 3;
            const descriptionLines = doc.splitTextToSize(String(preparedRow.description || ""), descriptionWidth);
            const rowHeight = Math.max(headerHeight, descriptionLines.length * lineHeight + 2);

            if (currentY + rowHeight > contentBottom) {
                doc.addPage();
                currentY = filterStartY + (filterSummary.length * 4.5) + 5;
                drawPageHeader();
                drawTableHeader(currentY);
                currentY += headerHeight;
            }

            drawRow(preparedRow, currentY);
            currentY += rowHeight;
        });

        const totalPages = doc.getNumberOfPages();
        for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
            doc.setPage(pageIndex);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(`PÃ¡gina ${pageIndex} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
        }

        doc.save(`relatorio_movimentacao_${formatFileStamp(generatedAt)}.pdf`);
    }

    return {
        saveMovementReportPdf: saveMovementReportPdf,
        formatMovementTypeLabel: getMovementTypeLabel,
        formatDateOnly: formatDateOnly
    };
});
