import { queryAll } from '../lib/sql.js';
import { createGraphAccumulator } from './graph-helpers.js';

function buildPlaceholders(values) {
  return values.map(() => '?').join(', ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getInitialGraph(db) {
  const graph = createGraphAccumulator();
  const seedLimit = 12;

  const seedSalesOrders = queryAll(db, `
    SELECT
      soh.sales_order,
      soh.sold_to_party,
      soh.total_net_amount,
      soh.transaction_currency,
      soh.overall_delivery_status,
      soh.creation_date
    FROM sales_order_headers soh
    ORDER BY soh.creation_date DESC
    LIMIT ${seedLimit}
  `);

  if (seedSalesOrders.length === 0) {
    return graph.getGraph();
  }

  const salesOrderIds = seedSalesOrders.map((salesOrder) => salesOrder.sales_order);
  const salesOrderPlaceholders = buildPlaceholders(salesOrderIds);

  for (const salesOrder of seedSalesOrders) {
    graph.addNode(`so_${salesOrder.sales_order}`, `SO ${salesOrder.sales_order}`, 'sales_order', {
      amount: salesOrder.total_net_amount,
      currency: salesOrder.transaction_currency,
      deliveryStatus: salesOrder.overall_delivery_status,
      date: salesOrder.creation_date,
    });
  }

  const customerIds = unique(seedSalesOrders.map((salesOrder) => salesOrder.sold_to_party));
  if (customerIds.length > 0) {
    const customerPlaceholders = buildPlaceholders(customerIds);
    const customers = queryAll(db, `
      SELECT DISTINCT
        bp.business_partner,
        bp.business_partner_name,
        bp.customer,
        bpa.city_name,
        bpa.country
      FROM business_partners bp
      LEFT JOIN business_partner_addresses bpa ON bp.business_partner = bpa.business_partner
      WHERE bp.business_partner IN (${customerPlaceholders})
    `, customerIds);

    for (const customer of customers) {
      graph.addNode(`customer_${customer.business_partner}`, customer.business_partner_name || customer.business_partner, 'customer', {
        city: customer.city_name,
        country: customer.country,
        customerId: customer.customer,
      });
    }

    for (const salesOrder of seedSalesOrders) {
      if (salesOrder.sold_to_party) {
        graph.addEdge(`customer_${salesOrder.sold_to_party}`, `so_${salesOrder.sales_order}`, 'placed_order');
      }
    }
  }

  const products = queryAll(db, `
    SELECT DISTINCT
      soi.sales_order,
      p.product,
      pd.product_description,
      p.product_type,
      p.product_group
    FROM sales_order_items soi
    JOIN products p ON soi.material = p.product
    LEFT JOIN product_descriptions pd ON p.product = pd.product AND pd.language = 'EN'
    WHERE soi.sales_order IN (${salesOrderPlaceholders})
  `, salesOrderIds);

  for (const product of products) {
    graph.addNode(`product_${product.product}`, product.product_description || product.product, 'product', {
      productType: product.product_type,
      productGroup: product.product_group,
    });
    graph.addEdge(`so_${product.sales_order}`, `product_${product.product}`, 'contains');
  }

  const deliveries = queryAll(db, `
    SELECT DISTINCT
      odi.reference_sd_document,
      odh.delivery_document,
      odh.overall_goods_movement_status,
      odh.shipping_point,
      odh.creation_date
    FROM outbound_delivery_items odi
    JOIN outbound_delivery_headers odh ON odi.delivery_document = odh.delivery_document
    WHERE odi.reference_sd_document IN (${salesOrderPlaceholders})
  `, salesOrderIds);

  for (const delivery of deliveries) {
    graph.addNode(`del_${delivery.delivery_document}`, `DEL ${delivery.delivery_document}`, 'delivery', {
      goodsMovement: delivery.overall_goods_movement_status,
      shippingPoint: delivery.shipping_point,
      date: delivery.creation_date,
    });
    graph.addEdge(`so_${delivery.reference_sd_document}`, `del_${delivery.delivery_document}`, 'delivered_by');
  }

  const plants = queryAll(db, `
    SELECT DISTINCT
      odi.delivery_document,
      p.plant,
      p.plant_name
    FROM outbound_delivery_items odi
    JOIN plants p ON odi.plant = p.plant
    WHERE odi.reference_sd_document IN (${salesOrderPlaceholders})
      AND odi.plant IS NOT NULL
      AND odi.plant != ''
  `, salesOrderIds);

  for (const plant of plants) {
    graph.addNode(`plant_${plant.plant}`, plant.plant_name || `Plant ${plant.plant}`, 'plant', {
      plantId: plant.plant,
    });
    graph.addEdge(`del_${plant.delivery_document}`, `plant_${plant.plant}`, 'ships_from');
  }

  const deliveryIds = unique(deliveries.map((delivery) => delivery.delivery_document));
  if (deliveryIds.length > 0) {
    const deliveryPlaceholders = buildPlaceholders(deliveryIds);
    const billingDocuments = queryAll(db, `
      SELECT DISTINCT
        bdi.reference_sd_document,
        bdh.billing_document,
        bdh.total_net_amount,
        bdh.transaction_currency,
        bdh.billing_document_is_cancelled,
        bdh.creation_date
      FROM billing_document_items bdi
      JOIN billing_document_headers bdh ON bdi.billing_document = bdh.billing_document
      WHERE bdi.reference_sd_document IN (${deliveryPlaceholders})
    `, deliveryIds);

    for (const billingDocument of billingDocuments) {
      graph.addNode(`bill_${billingDocument.billing_document}`, `BILL ${billingDocument.billing_document}`, 'billing', {
        amount: billingDocument.total_net_amount,
        currency: billingDocument.transaction_currency,
        cancelled: billingDocument.billing_document_is_cancelled,
        date: billingDocument.creation_date,
      });
      graph.addEdge(`del_${billingDocument.reference_sd_document}`, `bill_${billingDocument.billing_document}`, 'billed_as');
    }

    const billingIds = unique(billingDocuments.map((billingDocument) => billingDocument.billing_document));
    if (billingIds.length > 0) {
      const billingPlaceholders = buildPlaceholders(billingIds);
      const journalEntries = queryAll(db, `
        SELECT
          jei.accounting_document,
          jei.reference_document,
          SUM(CAST(jei.amount_in_transaction_currency AS REAL)) AS total_amount
        FROM journal_entry_items jei
        WHERE jei.reference_document IN (${billingPlaceholders})
        GROUP BY jei.accounting_document, jei.reference_document
      `, billingIds);

      for (const journalEntry of journalEntries) {
        graph.addNode(`je_${journalEntry.accounting_document}`, `JE ${journalEntry.accounting_document}`, 'journal_entry', {
          amount: journalEntry.total_amount,
          referenceDoc: journalEntry.reference_document,
        });
        graph.addEdge(`bill_${journalEntry.reference_document}`, `je_${journalEntry.accounting_document}`, 'journal_entry');
      }
    }
  }

  return graph.getGraph();
}
