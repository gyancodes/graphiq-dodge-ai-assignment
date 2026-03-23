import { queryAll, queryOne } from '../lib/sql.js';

export function getNodeDetail(db, nodeId) {
  const [type, ...idParts] = nodeId.split('_');
  const id = idParts.join('_');

  let data = {};
  let related = [];

  switch (type) {
    case 'customer': {
      data = queryOne(db, 'SELECT * FROM business_partners WHERE business_partner = ?', [id]);
      const addresses = queryAll(db, 'SELECT * FROM business_partner_addresses WHERE business_partner = ?', [id]);
      const salesOrders = queryAll(db, 'SELECT sales_order, total_net_amount, creation_date, overall_delivery_status FROM sales_order_headers WHERE sold_to_party = ?', [id]);
      related = [
        { type: 'addresses', data: addresses },
        { type: 'sales_orders', data: salesOrders },
      ];
      break;
    }

    case 'so': {
      data = queryOne(db, 'SELECT * FROM sales_order_headers WHERE sales_order = ?', [id]);
      const items = queryAll(db, `
        SELECT soi.*, pd.product_description
        FROM sales_order_items soi
        LEFT JOIN product_descriptions pd ON soi.material = pd.product AND pd.language = 'EN'
        WHERE soi.sales_order = ?
      `, [id]);
      const deliveries = queryAll(db, `
        SELECT DISTINCT odi.delivery_document, odh.overall_goods_movement_status, odh.creation_date
        FROM outbound_delivery_items odi
        JOIN outbound_delivery_headers odh ON odi.delivery_document = odh.delivery_document
        WHERE odi.reference_sd_document = ?
      `, [id]);
      related = [
        { type: 'items', data: items },
        { type: 'deliveries', data: deliveries },
      ];
      break;
    }

    case 'del': {
      data = queryOne(db, 'SELECT * FROM outbound_delivery_headers WHERE delivery_document = ?', [id]);
      const items = queryAll(db, 'SELECT * FROM outbound_delivery_items WHERE delivery_document = ?', [id]);
      const billingDocuments = queryAll(db, `
        SELECT DISTINCT bdi.billing_document, bdh.total_net_amount, bdh.billing_document_is_cancelled
        FROM billing_document_items bdi
        JOIN billing_document_headers bdh ON bdi.billing_document = bdh.billing_document
        WHERE bdi.reference_sd_document = ?
      `, [id]);
      related = [
        { type: 'items', data: items },
        { type: 'billing_documents', data: billingDocuments },
      ];
      break;
    }

    case 'bill': {
      data = queryOne(db, 'SELECT * FROM billing_document_headers WHERE billing_document = ?', [id]);
      const items = queryAll(db, `
        SELECT bdi.*, pd.product_description
        FROM billing_document_items bdi
        LEFT JOIN product_descriptions pd ON bdi.material = pd.product AND pd.language = 'EN'
        WHERE bdi.billing_document = ?
      `, [id]);
      const journalEntries = queryAll(db, 'SELECT * FROM journal_entry_items WHERE reference_document = ?', [id]);
      related = [
        { type: 'items', data: items },
        { type: 'journal_entries', data: journalEntries },
      ];
      break;
    }

    case 'product': {
      data = queryOne(db, 'SELECT * FROM products WHERE product = ?', [id]);
      const descriptions = queryAll(db, 'SELECT * FROM product_descriptions WHERE product = ?', [id]);
      const salesOrders = queryAll(db, `
        SELECT soi.sales_order, soi.net_amount, soi.requested_quantity
        FROM sales_order_items soi
        WHERE soi.material = ?
      `, [id]);
      related = [
        { type: 'descriptions', data: descriptions },
        { type: 'in_sales_orders', data: salesOrders },
      ];
      break;
    }

    case 'je': {
      data = queryAll(db, 'SELECT * FROM journal_entry_items WHERE accounting_document = ?', [id]);
      break;
    }

    case 'plant': {
      data = queryOne(db, 'SELECT * FROM plants WHERE plant = ?', [id]);
      break;
    }

    default:
      throw new Error(`Unsupported node type: ${type}`);
  }

  return { nodeId, type, data, related };
}
