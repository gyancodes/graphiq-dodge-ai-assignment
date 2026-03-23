import { queryAll, queryOne } from '../lib/sql.js';
import { createGraphAccumulator } from './graph-helpers.js';

export function expandGraphNode(db, nodeId) {
  const [type, ...idParts] = nodeId.split('_');
  const id = idParts.join('_');
  const graph = createGraphAccumulator();
  const limit = 20;

  switch (type) {
    case 'customer': {
      const customer = queryOne(db, `
        SELECT bp.business_partner, bp.business_partner_name, bp.customer, bpa.city_name, bpa.country
        FROM business_partners bp
        LEFT JOIN business_partner_addresses bpa ON bp.business_partner = bpa.business_partner
        WHERE bp.business_partner = ?
      `, [id]);

      if (customer) {
        graph.addNode(`customer_${customer.business_partner}`, customer.business_partner_name || customer.business_partner, 'customer', {
          city: customer.city_name,
          country: customer.country,
          customerId: customer.customer,
        });
      }

      const salesOrders = queryAll(db, `
        SELECT sales_order, sold_to_party, total_net_amount, transaction_currency, overall_delivery_status, creation_date
        FROM sales_order_headers
        WHERE sold_to_party = ?
        ORDER BY creation_date DESC
        LIMIT ${limit}
      `, [id]);

      for (const salesOrder of salesOrders) {
        graph.addNode(`so_${salesOrder.sales_order}`, `SO ${salesOrder.sales_order}`, 'sales_order', {
          amount: salesOrder.total_net_amount,
          currency: salesOrder.transaction_currency,
          deliveryStatus: salesOrder.overall_delivery_status,
          date: salesOrder.creation_date,
        });
        graph.addEdge(`customer_${id}`, `so_${salesOrder.sales_order}`, 'placed_order');
      }
      break;
    }

    case 'so': {
      const salesOrder = queryOne(db, `
        SELECT sales_order, sold_to_party, total_net_amount, transaction_currency, overall_delivery_status, creation_date
        FROM sales_order_headers
        WHERE sales_order = ?
      `, [id]);

      if (salesOrder) {
        graph.addNode(`so_${salesOrder.sales_order}`, `SO ${salesOrder.sales_order}`, 'sales_order', {
          amount: salesOrder.total_net_amount,
          currency: salesOrder.transaction_currency,
          deliveryStatus: salesOrder.overall_delivery_status,
          date: salesOrder.creation_date,
        });
      }

      if (salesOrder?.sold_to_party) {
        const customer = queryOne(db, `
          SELECT bp.business_partner, bp.business_partner_name, bp.customer, bpa.city_name, bpa.country
          FROM business_partners bp
          LEFT JOIN business_partner_addresses bpa ON bp.business_partner = bpa.business_partner
          WHERE bp.business_partner = ?
        `, [salesOrder.sold_to_party]);

        if (customer) {
          graph.addNode(`customer_${customer.business_partner}`, customer.business_partner_name || customer.business_partner, 'customer', {
            city: customer.city_name,
            country: customer.country,
            customerId: customer.customer,
          });
          graph.addEdge(`customer_${customer.business_partner}`, `so_${id}`, 'placed_order');
        }
      }

      const products = queryAll(db, `
        SELECT DISTINCT p.product, pd.product_description, p.product_type, p.product_group
        FROM sales_order_items soi
        JOIN products p ON soi.material = p.product
        LEFT JOIN product_descriptions pd ON p.product = pd.product AND pd.language = 'EN'
        WHERE soi.sales_order = ?
      `, [id]);

      for (const product of products) {
        graph.addNode(`product_${product.product}`, product.product_description || product.product, 'product', {
          productType: product.product_type,
          productGroup: product.product_group,
        });
        graph.addEdge(`so_${id}`, `product_${product.product}`, 'contains');
      }

      const deliveries = queryAll(db, `
        SELECT DISTINCT odh.delivery_document, odh.overall_goods_movement_status, odh.shipping_point, odh.creation_date
        FROM outbound_delivery_items odi
        JOIN outbound_delivery_headers odh ON odi.delivery_document = odh.delivery_document
        WHERE odi.reference_sd_document = ?
        ORDER BY odh.creation_date DESC
        LIMIT ${limit}
      `, [id]);

      for (const delivery of deliveries) {
        graph.addNode(`del_${delivery.delivery_document}`, `DEL ${delivery.delivery_document}`, 'delivery', {
          goodsMovement: delivery.overall_goods_movement_status,
          shippingPoint: delivery.shipping_point,
          date: delivery.creation_date,
        });
        graph.addEdge(`so_${id}`, `del_${delivery.delivery_document}`, 'delivered_by');
      }
      break;
    }

    case 'del': {
      const delivery = queryOne(db, `
        SELECT delivery_document, overall_goods_movement_status, shipping_point, creation_date
        FROM outbound_delivery_headers
        WHERE delivery_document = ?
      `, [id]);

      if (delivery) {
        graph.addNode(`del_${delivery.delivery_document}`, `DEL ${delivery.delivery_document}`, 'delivery', {
          goodsMovement: delivery.overall_goods_movement_status,
          shippingPoint: delivery.shipping_point,
          date: delivery.creation_date,
        });
      }

      const salesOrders = queryAll(db, `
        SELECT DISTINCT soh.sales_order, soh.sold_to_party, soh.total_net_amount, soh.transaction_currency,
               soh.overall_delivery_status, soh.creation_date
        FROM outbound_delivery_items odi
        JOIN sales_order_headers soh ON odi.reference_sd_document = soh.sales_order
        WHERE odi.delivery_document = ?
      `, [id]);

      for (const salesOrder of salesOrders) {
        graph.addNode(`so_${salesOrder.sales_order}`, `SO ${salesOrder.sales_order}`, 'sales_order', {
          amount: salesOrder.total_net_amount,
          currency: salesOrder.transaction_currency,
          deliveryStatus: salesOrder.overall_delivery_status,
          date: salesOrder.creation_date,
        });
        graph.addEdge(`so_${salesOrder.sales_order}`, `del_${id}`, 'delivered_by');
      }

      const plants = queryAll(db, `
        SELECT DISTINCT p.plant, p.plant_name
        FROM outbound_delivery_items odi
        JOIN plants p ON odi.plant = p.plant
        WHERE odi.delivery_document = ?
      `, [id]);

      for (const plant of plants) {
        graph.addNode(`plant_${plant.plant}`, plant.plant_name || `Plant ${plant.plant}`, 'plant', {
          plantId: plant.plant,
        });
        graph.addEdge(`del_${id}`, `plant_${plant.plant}`, 'ships_from');
      }

      const billingDocuments = queryAll(db, `
        SELECT DISTINCT bdh.billing_document, bdh.total_net_amount, bdh.transaction_currency,
               bdh.billing_document_is_cancelled, bdh.creation_date
        FROM billing_document_items bdi
        JOIN billing_document_headers bdh ON bdi.billing_document = bdh.billing_document
        WHERE bdi.reference_sd_document = ?
        ORDER BY bdh.creation_date DESC
        LIMIT ${limit}
      `, [id]);

      for (const billingDocument of billingDocuments) {
        graph.addNode(`bill_${billingDocument.billing_document}`, `BILL ${billingDocument.billing_document}`, 'billing', {
          amount: billingDocument.total_net_amount,
          currency: billingDocument.transaction_currency,
          cancelled: billingDocument.billing_document_is_cancelled,
          date: billingDocument.creation_date,
        });
        graph.addEdge(`del_${id}`, `bill_${billingDocument.billing_document}`, 'billed_as');
      }
      break;
    }

    case 'bill': {
      const billingDocument = queryOne(db, `
        SELECT billing_document, total_net_amount, transaction_currency, billing_document_is_cancelled, creation_date
        FROM billing_document_headers
        WHERE billing_document = ?
      `, [id]);

      if (billingDocument) {
        graph.addNode(`bill_${billingDocument.billing_document}`, `BILL ${billingDocument.billing_document}`, 'billing', {
          amount: billingDocument.total_net_amount,
          currency: billingDocument.transaction_currency,
          cancelled: billingDocument.billing_document_is_cancelled,
          date: billingDocument.creation_date,
        });
      }

      const deliveries = queryAll(db, `
        SELECT DISTINCT odh.delivery_document, odh.overall_goods_movement_status, odh.shipping_point, odh.creation_date
        FROM billing_document_items bdi
        JOIN outbound_delivery_headers odh ON bdi.reference_sd_document = odh.delivery_document
        WHERE bdi.billing_document = ?
      `, [id]);

      for (const delivery of deliveries) {
        graph.addNode(`del_${delivery.delivery_document}`, `DEL ${delivery.delivery_document}`, 'delivery', {
          goodsMovement: delivery.overall_goods_movement_status,
          shippingPoint: delivery.shipping_point,
          date: delivery.creation_date,
        });
        graph.addEdge(`del_${delivery.delivery_document}`, `bill_${id}`, 'billed_as');
      }

      const journalEntries = queryAll(db, `
        SELECT accounting_document, reference_document,
               SUM(CAST(amount_in_transaction_currency AS REAL)) AS total_amount
        FROM journal_entry_items
        WHERE reference_document = ?
        GROUP BY accounting_document, reference_document
      `, [id]);

      for (const journalEntry of journalEntries) {
        graph.addNode(`je_${journalEntry.accounting_document}`, `JE ${journalEntry.accounting_document}`, 'journal_entry', {
          amount: journalEntry.total_amount,
          referenceDoc: journalEntry.reference_document,
        });
        graph.addEdge(`bill_${id}`, `je_${journalEntry.accounting_document}`, 'journal_entry');
      }

      const products = queryAll(db, `
        SELECT DISTINCT p.product, pd.product_description, p.product_type, p.product_group
        FROM billing_document_items bdi
        JOIN products p ON bdi.material = p.product
        LEFT JOIN product_descriptions pd ON p.product = pd.product AND pd.language = 'EN'
        WHERE bdi.billing_document = ?
      `, [id]);

      for (const product of products) {
        graph.addNode(`product_${product.product}`, product.product_description || product.product, 'product', {
          productType: product.product_type,
          productGroup: product.product_group,
        });
        graph.addEdge(`bill_${id}`, `product_${product.product}`, 'includes_product');
      }
      break;
    }

    case 'product': {
      const product = queryOne(db, `
        SELECT p.product, pd.product_description, p.product_type, p.product_group
        FROM products p
        LEFT JOIN product_descriptions pd ON p.product = pd.product AND pd.language = 'EN'
        WHERE p.product = ?
      `, [id]);

      if (product) {
        graph.addNode(`product_${product.product}`, product.product_description || product.product, 'product', {
          productType: product.product_type,
          productGroup: product.product_group,
        });
      }

      const salesOrders = queryAll(db, `
        SELECT DISTINCT soh.sales_order, soh.total_net_amount, soh.transaction_currency,
               soh.overall_delivery_status, soh.creation_date
        FROM sales_order_items soi
        JOIN sales_order_headers soh ON soi.sales_order = soh.sales_order
        WHERE soi.material = ?
        ORDER BY soh.creation_date DESC
        LIMIT ${limit}
      `, [id]);

      for (const salesOrder of salesOrders) {
        graph.addNode(`so_${salesOrder.sales_order}`, `SO ${salesOrder.sales_order}`, 'sales_order', {
          amount: salesOrder.total_net_amount,
          currency: salesOrder.transaction_currency,
          deliveryStatus: salesOrder.overall_delivery_status,
          date: salesOrder.creation_date,
        });
        graph.addEdge(`so_${salesOrder.sales_order}`, `product_${id}`, 'contains');
      }

      const billingDocuments = queryAll(db, `
        SELECT DISTINCT bdh.billing_document, bdh.total_net_amount, bdh.transaction_currency,
               bdh.billing_document_is_cancelled, bdh.creation_date
        FROM billing_document_items bdi
        JOIN billing_document_headers bdh ON bdi.billing_document = bdh.billing_document
        WHERE bdi.material = ?
        ORDER BY bdh.creation_date DESC
        LIMIT ${limit}
      `, [id]);

      for (const billingDocument of billingDocuments) {
        graph.addNode(`bill_${billingDocument.billing_document}`, `BILL ${billingDocument.billing_document}`, 'billing', {
          amount: billingDocument.total_net_amount,
          currency: billingDocument.transaction_currency,
          cancelled: billingDocument.billing_document_is_cancelled,
          date: billingDocument.creation_date,
        });
        graph.addEdge(`bill_${billingDocument.billing_document}`, `product_${id}`, 'includes_product');
      }
      break;
    }

    case 'plant': {
      const plant = queryOne(db, 'SELECT plant, plant_name FROM plants WHERE plant = ?', [id]);

      if (plant) {
        graph.addNode(`plant_${plant.plant}`, plant.plant_name || `Plant ${plant.plant}`, 'plant', {
          plantId: plant.plant,
        });
      }

      const salesOrders = queryAll(db, `
        SELECT DISTINCT soh.sales_order, soh.total_net_amount, soh.transaction_currency,
               soh.overall_delivery_status, soh.creation_date
        FROM sales_order_items soi
        JOIN sales_order_headers soh ON soi.sales_order = soh.sales_order
        WHERE soi.production_plant = ?
        ORDER BY soh.creation_date DESC
        LIMIT ${limit}
      `, [id]);

      for (const salesOrder of salesOrders) {
        graph.addNode(`so_${salesOrder.sales_order}`, `SO ${salesOrder.sales_order}`, 'sales_order', {
          amount: salesOrder.total_net_amount,
          currency: salesOrder.transaction_currency,
          deliveryStatus: salesOrder.overall_delivery_status,
          date: salesOrder.creation_date,
        });
        graph.addEdge(`so_${salesOrder.sales_order}`, `plant_${id}`, 'produced_at');
      }

      const deliveries = queryAll(db, `
        SELECT DISTINCT odh.delivery_document, odh.overall_goods_movement_status, odh.shipping_point, odh.creation_date
        FROM outbound_delivery_items odi
        JOIN outbound_delivery_headers odh ON odi.delivery_document = odh.delivery_document
        WHERE odi.plant = ?
        ORDER BY odh.creation_date DESC
        LIMIT ${limit}
      `, [id]);

      for (const delivery of deliveries) {
        graph.addNode(`del_${delivery.delivery_document}`, `DEL ${delivery.delivery_document}`, 'delivery', {
          goodsMovement: delivery.overall_goods_movement_status,
          shippingPoint: delivery.shipping_point,
          date: delivery.creation_date,
        });
        graph.addEdge(`del_${delivery.delivery_document}`, `plant_${id}`, 'ships_from');
      }
      break;
    }

    case 'je': {
      const journalEntry = queryOne(db, `
        SELECT accounting_document, reference_document,
               SUM(CAST(amount_in_transaction_currency AS REAL)) AS total_amount
        FROM journal_entry_items
        WHERE accounting_document = ?
        GROUP BY accounting_document, reference_document
      `, [id]);

      if (journalEntry) {
        graph.addNode(`je_${journalEntry.accounting_document}`, `JE ${journalEntry.accounting_document}`, 'journal_entry', {
          amount: journalEntry.total_amount,
          referenceDoc: journalEntry.reference_document,
        });
      }

      if (journalEntry?.reference_document) {
        const billingDocument = queryOne(db, `
          SELECT billing_document, total_net_amount, transaction_currency, billing_document_is_cancelled, creation_date
          FROM billing_document_headers
          WHERE billing_document = ?
        `, [journalEntry.reference_document]);

        if (billingDocument) {
          graph.addNode(`bill_${billingDocument.billing_document}`, `BILL ${billingDocument.billing_document}`, 'billing', {
            amount: billingDocument.total_net_amount,
            currency: billingDocument.transaction_currency,
            cancelled: billingDocument.billing_document_is_cancelled,
            date: billingDocument.creation_date,
          });
          graph.addEdge(`bill_${billingDocument.billing_document}`, `je_${id}`, 'journal_entry');
        }
      }
      break;
    }

    default:
      throw new Error(`Unsupported node type: ${type}`);
  }

  return {
    expandedFrom: nodeId,
    ...graph.getGraph(),
  };
}
