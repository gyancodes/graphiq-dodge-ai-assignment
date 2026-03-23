import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { getDb, saveDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapping from directory name to table name and column mapping
const TABLE_CONFIG = {
  business_partners: {
    table: 'business_partners',
    columns: {
      businessPartner: 'business_partner',
      customer: 'customer',
      businessPartnerCategory: 'business_partner_category',
      businessPartnerFullName: 'business_partner_full_name',
      businessPartnerGrouping: 'business_partner_grouping',
      businessPartnerName: 'business_partner_name',
      correspondenceLanguage: 'correspondence_language',
      createdByUser: 'created_by_user',
      creationDate: 'creation_date',
      firstName: 'first_name',
      formOfAddress: 'form_of_address',
      industry: 'industry',
      lastChangeDate: 'last_change_date',
      lastName: 'last_name',
      organizationBpName1: 'organization_bp_name1',
      organizationBpName2: 'organization_bp_name2',
      businessPartnerIsBlocked: 'business_partner_is_blocked',
      isMarkedForArchiving: 'is_marked_for_archiving',
    }
  },
  business_partner_addresses: {
    table: 'business_partner_addresses',
    columns: {
      businessPartner: 'business_partner',
      addressId: 'address_id',
      validityStartDate: 'validity_start_date',
      validityEndDate: 'validity_end_date',
      addressUuid: 'address_uuid',
      addressTimeZone: 'address_time_zone',
      cityName: 'city_name',
      country: 'country',
      postalCode: 'postal_code',
      region: 'region',
      streetName: 'street_name',
      transportZone: 'transport_zone',
    }
  },
  plants: {
    table: 'plants',
    columns: {
      plant: 'plant',
      plantName: 'plant_name',
      valuationArea: 'valuation_area',
      plantCustomer: 'plant_customer',
      plantSupplier: 'plant_supplier',
      factoryCalendar: 'factory_calendar',
      defaultPurchasingOrganization: 'default_purchasing_organization',
      salesOrganization: 'sales_organization',
      addressId: 'address_id',
      plantCategory: 'plant_category',
      distributionChannel: 'distribution_channel',
      division: 'division',
      language: 'language',
      isMarkedForArchiving: 'is_marked_for_archiving',
    }
  },
  products: {
    table: 'products',
    columns: {
      product: 'product',
      productType: 'product_type',
      crossPlantStatus: 'cross_plant_status',
      crossPlantStatusValidityDate: 'cross_plant_status_validity_date',
      creationDate: 'creation_date',
      createdByUser: 'created_by_user',
      lastChangeDate: 'last_change_date',
      lastChangeDateTime: 'last_change_date_time',
      isMarkedForDeletion: 'is_marked_for_deletion',
      productOldId: 'product_old_id',
      grossWeight: 'gross_weight',
      weightUnit: 'weight_unit',
      netWeight: 'net_weight',
      productGroup: 'product_group',
      baseUnit: 'base_unit',
      division: 'division',
      industrySector: 'industry_sector',
    }
  },
  product_descriptions: {
    table: 'product_descriptions',
    columns: {
      product: 'product',
      language: 'language',
      productDescription: 'product_description',
    }
  },
  sales_order_headers: {
    table: 'sales_order_headers',
    columns: {
      salesOrder: 'sales_order',
      salesOrderType: 'sales_order_type',
      salesOrganization: 'sales_organization',
      distributionChannel: 'distribution_channel',
      organizationDivision: 'organization_division',
      salesGroup: 'sales_group',
      salesOffice: 'sales_office',
      soldToParty: 'sold_to_party',
      creationDate: 'creation_date',
      createdByUser: 'created_by_user',
      lastChangeDateTime: 'last_change_date_time',
      totalNetAmount: 'total_net_amount',
      overallDeliveryStatus: 'overall_delivery_status',
      overallOrdReltdBillgStatus: 'overall_ord_reltd_billg_status',
      overallSdDocReferenceStatus: 'overall_sd_doc_reference_status',
      transactionCurrency: 'transaction_currency',
      pricingDate: 'pricing_date',
      requestedDeliveryDate: 'requested_delivery_date',
      headerBillingBlockReason: 'header_billing_block_reason',
      deliveryBlockReason: 'delivery_block_reason',
      incotermsClassification: 'incoterms_classification',
      incotermsLocation1: 'incoterms_location1',
      customerPaymentTerms: 'customer_payment_terms',
      totalCreditCheckStatus: 'total_credit_check_status',
    }
  },
  sales_order_items: {
    table: 'sales_order_items',
    columns: {
      salesOrder: 'sales_order',
      salesOrderItem: 'sales_order_item',
      salesOrderItemCategory: 'sales_order_item_category',
      material: 'material',
      requestedQuantity: 'requested_quantity',
      requestedQuantityUnit: 'requested_quantity_unit',
      transactionCurrency: 'transaction_currency',
      netAmount: 'net_amount',
      materialGroup: 'material_group',
      productionPlant: 'production_plant',
      storageLocation: 'storage_location',
      salesDocumentRjcnReason: 'sales_document_rjcn_reason',
      itemBillingBlockReason: 'item_billing_block_reason',
    }
  },
  sales_order_schedule_lines: {
    table: 'sales_order_schedule_lines',
    columns: {
      salesOrder: 'sales_order',
      salesOrderItem: 'sales_order_item',
      scheduleLine: 'schedule_line',
      confirmedDeliveryDate: 'confirmed_delivery_date',
      orderQuantityUnit: 'order_quantity_unit',
      confdOrderQtyByMatlAvailCheck: 'confd_order_qty_by_matl_avail_check',
    }
  },
  outbound_delivery_headers: {
    table: 'outbound_delivery_headers',
    columns: {
      deliveryDocument: 'delivery_document',
      actualGoodsMovementDate: 'actual_goods_movement_date',
      creationDate: 'creation_date',
      deliveryBlockReason: 'delivery_block_reason',
      hdrGeneralIncompletionStatus: 'hdr_general_incompletion_status',
      headerBillingBlockReason: 'header_billing_block_reason',
      lastChangeDate: 'last_change_date',
      overallGoodsMovementStatus: 'overall_goods_movement_status',
      overallPickingStatus: 'overall_picking_status',
      overallProofOfDeliveryStatus: 'overall_proof_of_delivery_status',
      shippingPoint: 'shipping_point',
    }
  },
  outbound_delivery_items: {
    table: 'outbound_delivery_items',
    columns: {
      deliveryDocument: 'delivery_document',
      deliveryDocumentItem: 'delivery_document_item',
      actualDeliveryQuantity: 'actual_delivery_quantity',
      batch: 'batch',
      deliveryQuantityUnit: 'delivery_quantity_unit',
      itemBillingBlockReason: 'item_billing_block_reason',
      lastChangeDate: 'last_change_date',
      plant: 'plant',
      referenceSdDocument: 'reference_sd_document',
      referenceSdDocumentItem: 'reference_sd_document_item',
      storageLocation: 'storage_location',
    }
  },
  billing_document_headers: {
    table: 'billing_document_headers',
    columns: {
      billingDocument: 'billing_document',
      billingDocumentType: 'billing_document_type',
      creationDate: 'creation_date',
      lastChangeDateTime: 'last_change_date_time',
      billingDocumentDate: 'billing_document_date',
      billingDocumentIsCancelled: 'billing_document_is_cancelled',
      cancelledBillingDocument: 'cancelled_billing_document',
      totalNetAmount: 'total_net_amount',
      transactionCurrency: 'transaction_currency',
      companyCode: 'company_code',
      fiscalYear: 'fiscal_year',
      accountingDocument: 'accounting_document',
      soldToParty: 'sold_to_party',
    }
  },
  billing_document_items: {
    table: 'billing_document_items',
    columns: {
      billingDocument: 'billing_document',
      billingDocumentItem: 'billing_document_item',
      material: 'material',
      billingQuantity: 'billing_quantity',
      billingQuantityUnit: 'billing_quantity_unit',
      netAmount: 'net_amount',
      transactionCurrency: 'transaction_currency',
      referenceSdDocument: 'reference_sd_document',
      referenceSdDocumentItem: 'reference_sd_document_item',
    }
  },
  billing_document_cancellations: {
    table: 'billing_document_cancellations',
    columns: {
      billingDocument: 'billing_document',
      billingDocumentType: 'billing_document_type',
      creationDate: 'creation_date',
      lastChangeDateTime: 'last_change_date_time',
      billingDocumentDate: 'billing_document_date',
      billingDocumentIsCancelled: 'billing_document_is_cancelled',
      cancelledBillingDocument: 'cancelled_billing_document',
      totalNetAmount: 'total_net_amount',
      transactionCurrency: 'transaction_currency',
      companyCode: 'company_code',
      fiscalYear: 'fiscal_year',
      accountingDocument: 'accounting_document',
      soldToParty: 'sold_to_party',
    }
  },
  journal_entry_items_accounts_receivable: {
    table: 'journal_entry_items',
    columns: {
      companyCode: 'company_code',
      fiscalYear: 'fiscal_year',
      accountingDocument: 'accounting_document',
      accountingDocumentItem: 'accounting_document_item',
      glAccount: 'gl_account',
      referenceDocument: 'reference_document',
      costCenter: 'cost_center',
      profitCenter: 'profit_center',
      transactionCurrency: 'transaction_currency',
      amountInTransactionCurrency: 'amount_in_transaction_currency',
      companyCodeCurrency: 'company_code_currency',
      amountInCompanyCodeCurrency: 'amount_in_company_code_currency',
      postingDate: 'posting_date',
      documentDate: 'document_date',
      accountingDocumentType: 'accounting_document_type',
      assignmentReference: 'assignment_reference',
      lastChangeDateTime: 'last_change_date_time',
      customer: 'customer',
      financialAccountType: 'financial_account_type',
      clearingDate: 'clearing_date',
      clearingAccountingDocument: 'clearing_accounting_document',
      clearingDocFiscalYear: 'clearing_doc_fiscal_year',
    }
  },
  payments_accounts_receivable: {
    table: 'payments',
    columns: {
      companyCode: 'company_code',
      fiscalYear: 'fiscal_year',
      accountingDocument: 'accounting_document',
      accountingDocumentItem: 'accounting_document_item',
      clearingDate: 'clearing_date',
      clearingAccountingDocument: 'clearing_accounting_document',
      clearingDocFiscalYear: 'clearing_doc_fiscal_year',
      amountInTransactionCurrency: 'amount_in_transaction_currency',
      transactionCurrency: 'transaction_currency',
      amountInCompanyCodeCurrency: 'amount_in_company_code_currency',
      companyCodeCurrency: 'company_code_currency',
      customer: 'customer',
      invoiceReference: 'invoice_reference',
      invoiceReferenceFiscalYear: 'invoice_reference_fiscal_year',
      salesDocument: 'sales_document',
      salesDocumentItem: 'sales_document_item',
      postingDate: 'posting_date',
      documentDate: 'document_date',
      assignmentReference: 'assignment_reference',
      glAccount: 'gl_account',
      financialAccountType: 'financial_account_type',
      profitCenter: 'profit_center',
      costCenter: 'cost_center',
    }
  },
  customer_company_assignments: {
    table: 'customer_company_assignments',
    columns: {
      customer: 'customer',
      companyCode: 'company_code',
      accountingClerk: 'accounting_clerk',
      paymentBlockingReason: 'payment_blocking_reason',
      paymentMethodsList: 'payment_methods_list',
      paymentTerms: 'payment_terms',
      reconciliationAccount: 'reconciliation_account',
      deletionIndicator: 'deletion_indicator',
      customerAccountGroup: 'customer_account_group',
    }
  },
  customer_sales_area_assignments: {
    table: 'customer_sales_area_assignments',
    columns: {
      customer: 'customer',
      salesOrganization: 'sales_organization',
      distributionChannel: 'distribution_channel',
      division: 'division',
      billingIsBlockedForCustomer: 'billing_is_blocked_for_customer',
      completeDeliveryIsDefined: 'complete_delivery_is_defined',
      creditControlArea: 'credit_control_area',
      currency: 'currency',
      customerPaymentTerms: 'customer_payment_terms',
      deliveryPriority: 'delivery_priority',
      incotermsClassification: 'incoterms_classification',
      incotermsLocation1: 'incoterms_location1',
      salesGroup: 'sales_group',
      salesOffice: 'sales_office',
      shippingCondition: 'shipping_condition',
      slsUnlmtdOvrdelivIsAllwd: 'sls_unlmtd_ovrdeliv_is_allwd',
      supplyingPlant: 'supplying_plant',
      salesDistrict: 'sales_district',
      exchangeRateType: 'exchange_rate_type',
    }
  },
};

const SKIP_DIRS = ['product_plants', 'product_storage_locations'];

async function readJsonlFile(filePath) {
  const records = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (e) {
      console.warn(`  ⚠ Skipped malformed line in ${path.basename(filePath)}`);
    }
  }
  return records;
}

function flattenValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && !Array.isArray(val)) {
    if ('hours' in val && 'minutes' in val) {
      return `${String(val.hours).padStart(2, '0')}:${String(val.minutes).padStart(2, '0')}:${String(val.seconds || 0).padStart(2, '0')}`;
    }
    return JSON.stringify(val);
  }
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

function insertRecords(db, tableName, columnMap, records) {
  if (records.length === 0) return;
  
  const dbColumns = [...new Set(Object.values(columnMap))];
  const colStr = dbColumns.join(', ');
  const placeholders = dbColumns.map(() => '?').join(', ');
  
  const sql = `INSERT OR IGNORE INTO ${tableName} (${colStr}) VALUES (${placeholders})`;
  const stmt = db.prepare(sql);
  
  for (const row of records) {
    const values = dbColumns.map(dbCol => {
      const jsonKey = Object.keys(columnMap).find(k => columnMap[k] === dbCol);
      if (!jsonKey) return null;
      return flattenValue(row[jsonKey]);
    });
    try {
      stmt.bind(values);
      stmt.step();
      stmt.reset();
    } catch (e) {
      // ignore duplicate key errors
    }
  }
  
  stmt.free();
}

// Helper to run sql.js query and get results as array of objects
function queryAll(db, sql) {
  const stmt = db.prepare(sql);
  const results = [];
  const cols = stmt.getColumnNames();
  while (stmt.step()) {
    const row = stmt.get();
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    results.push(obj);
  }
  stmt.free();
  return results;
}

async function ingest() {
  const dataDir = path.join(__dirname, '../dataset/sap-data/sap-o2c-data');
  
  if (!fs.existsSync(dataDir)) {
    console.error('❌ Dataset directory not found:', dataDir);
    console.error('   Please extract the SAP dataset to dataset/sap-data/sap-o2c-data/');
    process.exit(1);
  }
  
  const db = await getDb();
  
  // Initialize schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.run(schema);
  console.log('✅ Schema initialized');
  
  const ingestionOrder = [
    'business_partners',
    'business_partner_addresses',
    'plants',
    'products',
    'product_descriptions',
    'customer_company_assignments',
    'customer_sales_area_assignments',
    'sales_order_headers',
    'sales_order_items',
    'sales_order_schedule_lines',
    'outbound_delivery_headers',
    'outbound_delivery_items',
    'billing_document_headers',
    'billing_document_items',
    'billing_document_cancellations',
    'journal_entry_items_accounts_receivable',
    'payments_accounts_receivable',
  ];
  
  for (const dirName of ingestionOrder) {
    if (SKIP_DIRS.includes(dirName)) continue;
    
    const config = TABLE_CONFIG[dirName];
    if (!config) {
      console.warn(`⚠ No config for directory: ${dirName}`);
      continue;
    }
    
    const dirPath = path.join(dataDir, dirName);
    if (!fs.existsSync(dirPath)) {
      console.warn(`⚠ Directory not found: ${dirName}`);
      continue;
    }
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
    let totalRecords = 0;
    
    db.run('BEGIN TRANSACTION');
    for (const file of files) {
      const records = await readJsonlFile(path.join(dirPath, file));
      insertRecords(db, config.table, config.columns, records);
      totalRecords += records.length;
    }
    db.run('COMMIT');
    
    console.log(`✅ ${config.table}: ${totalRecords} records ingested`);
  }
  
  // Save to disk
  saveDb();
  
  // Print summary
  console.log('\n📊 Database Summary:');
  const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  for (const t of tables) {
    const count = queryAll(db, `SELECT COUNT(*) as c FROM ${t.name}`);
    console.log(`   ${t.name}: ${count[0].c} rows`);
  }
  
  console.log('\n✅ Ingestion complete! Database saved to graphiq.db');
}

ingest().catch(err => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
