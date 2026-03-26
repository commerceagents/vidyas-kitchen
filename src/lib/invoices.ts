import { jsPDF } from "jspdf";
import "jspdf-autotable";

export async function generateInvoicePDF(order: any, items: any[]) {
  const doc = new jsPDF() as any;

  // Header 
  doc.setFontSize(22);
  doc.setTextColor(226, 31, 39); // Vidya's Kitchen Brand Red (#E21F27)
  doc.text("Vidya's Kitchen", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Authentic Home Style Cooking | Sivakasi", 105, 28, { align: "center" });

  // Order Details
  doc.line(20, 35, 190, 35); // Horizontal line
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Invoice #: ${order.id.slice(0, 8).toUpperCase()}`, 20, 45);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 190, 45, { align: "right" });
  doc.text(`Customer: ${order.users?.full_name || "Guest"}`, 20, 52);

  // Table header
  const tableData = items.map((item, index) => [
    index + 1,
    item.menu_items?.name || "Unknown Item",
    item.quantity,
    `₹${item.price}`,
    `₹${item.quantity * item.price}`
  ]);

  (doc as any).autoTable({
    startY: 60,
    head: [['#', 'Item', 'Qty', 'Unit Price', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [226, 31, 39] } // Brand Red
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Total
  doc.setFontSize(14);
  doc.text(`Total Amount: ₹${order.total_amount}`, 190, finalY, { align: "right" });

  // Footer / Payment Status
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Thank you for choosing Vidya's Kitchen!", 105, finalY + 20, { align: "center" });
  doc.text("This is an electronically generated invoice.", 105, finalY + 25, { align: "center" });

  return doc.output("arraybuffer");
}
