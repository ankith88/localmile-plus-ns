/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 *
 * Module Description
 *
 * @Last Modified by:   Sruti Desai
 *
 */

define([
  "N/runtime",
  "N/search",
  "N/record",
  "N/log",
  "N/task",
  "N/currentRecord",
  "N/format"
], function (runtime, search, record, log, task, currentRecord, format) {
  var zee = 0;
  var role = runtime.getCurrentUser().role;

  var usage_threshold = 30; //20
  var usage_threshold_invoice = 1000; //1000
  var adhoc_inv_deploy = "customdeploy2";
  var prev_inv_deploy = null;
  var ctx = runtime.getCurrentScript();

  var service_start_date;
  var service_end_date;
  var franchisee;
  var from_invoice = null;
  var count_loop_cust = 0;

  var error_customers = [];
  var error_specialCustomers = [];

  function addInvoiceItems(recInvoice, invoiceLineItems) {
    for (var i = 0; i < invoiceLineItems.length; i++) {
      recInvoice.selectNewLine({
        sublistId: "item"
      });

      recInvoice.setCurrentSublistValue({
        sublistId: "item",
        fieldId: "item",
        value: invoiceLineItems[i].item
      });

      recInvoice.setCurrentSublistValue({
        sublistId: "item",
        fieldId: "quantity",
        value: invoiceLineItems[i].quantity
      });

      recInvoice.setCurrentSublistValue({
        sublistId: "item",
        fieldId: "rate",
        value: invoiceLineItems[i].rate
      });
      recInvoice.commitLine({ sublistId: "item" });
    }
  }

  function updateInvoiceJobs(jobInternalIdArray, invoiceId) {
    for (var i = 0; i < jobInternalIdArray.length; i++) {
      var job_record = record.load({
        type: "customrecord_job",
        id: jobInternalIdArray[i]
      });
      job_record.setValue({
        fieldId: "custrecord_job_invoice",
        value: invoiceId
      });
      job_record.setValue({
        fieldId: "custrecord_job_date_reviewed",
        value: getDateStoreNS()
      });
      job_record.setValue({
        fieldId: "custrecord_job_date_inv_finalised",
        value: getDateStoreNS()
      });
      job_record.setValue({
        fieldId: "custrecord_job_date_invoiced",
        value: getDateStoreNS()
      });
      // job_record.save({
      //   enableSourcing: true,
      //   ignoreMandatoryFields: true
      // });
    }
  }

  function createInvoiceForCustomer(
    customerId,
    franchiseeId,
    invoiceLineItems,
    jobInternalIdArray,
    options
  ) {
    options = options || {};

    var recInvoice = record.create({
      type: record.Type.INVOICE,
      isDynamic: true
    });

    recInvoice.setValue({
      fieldId: "customform",
      value: options.customform || 116
    });
    recInvoice.setValue({
      fieldId: "entity",
      value: customerId
    });

    var partnerRecord = record.load({
      type: record.Type.PARTNER,
      id: franchiseeId
    });

    recInvoice.setValue({
      fieldId: "department",
      value: partnerRecord.getValue({ fieldId: "department" })
    });
    recInvoice.setValue({
      fieldId: "location",
      value: partnerRecord.getValue({ fieldId: "location" })
    });

    recInvoice.setValue({
      fieldId: "trandate",
      value: getDateStoreNS()
    });
    recInvoice.setValue({
      fieldId: "custbody_dont_update_trandate",
      value: true
    });
    recInvoice.setValue({
      fieldId: "custbody_inv_date_range_from",
      value: getWeekStartNS()
    });
    recInvoice.setValue({
      fieldId: "custbody_inv_date_range_to",
      value: getWeekEndNS()
    });

    if (!isNullorEmpty(options.invType)) {
      recInvoice.setValue({
        fieldId: "custbody_inv_type",
        value: options.invType
      });
    }

    recInvoice.setValue({ fieldId: "partner", value: franchiseeId });
    recInvoice.setValue({ fieldId: "terms", value: options.terms || 1 });

    addInvoiceItems(recInvoice, invoiceLineItems);

    // var invoiceId = recInvoice.save({
    //   enableSourcing: true,
    //   ignoreMandatoryFields: true
    // });

    updateInvoiceJobs(jobInternalIdArray, invoiceId);
    return invoiceId;
  }

  function invoiceCreation() {
    //NetSuite Search: LocalMile.PLUS - Jobs Completed - To be Invoiced
    var searched_summary = search.load({
      id: "customsearch_lmp_jobs_complete_to_invoic",
      type: "customrecord_jobgroup"
    });

    var resultSet_summary = searched_summary.run();

    var oldCustomerInternalId = null;
    var oldServiceInternalId = null;
    var oldAppJobGroupInternalId = null;
    var oldNSItemInternalId = null;
    var oldNSItemRate = null;
    var oldFranchisee = null;
    var nsItemTotalQty = 0;
    var jobCount = 0;
    var newInvoice = false;
    var invoiceLineItems = [];
    var jobInternalIdArray = [];
    resultSet_summary.each(function (searchResult_summary) {
      //Customer
      var app_job_group_internal_id = searchResult_summary.getValue({
        name: "internalid"
      });
      var customer_internal_id = searchResult_summary.getValue({
        name: "custrecord_jobgroup_customer"
      });
      var franchisee = searchResult_summary.getValue({
        name: "custrecord_jobgroup_franchisee"
      });
      var serviceInternalId = searchResult_summary.getValue({
        name: "custrecord_jobgroup_service"
      });
      var nsItemInternalId = searchResult_summary.getValue({
        name: "custrecord_service_ns_item",
        join: "CUSTRECORD_JOBGROUP_SERVICE"
      });
      var nsItemRate = searchResult_summary.getValue({
        name: "custrecord_service_price",
        join: "CUSTRECORD_JOBGROUP_SERVICE"
      });
      if (nsItemRate == 0.0) {
        nsItemRate = 0.0;
      }
      var jobInternalId = searchResult_summary.getValue({
        name: "internalid",
        join: "CUSTRECORD_JOB_GROUP"
      });

      log.debug({
        title: "customer_internal_id",
        details: customer_internal_id
      });
      log.debug({
        title: "franchisee",
        details: franchisee
      });
      log.debug({
        title: "serviceInternalId",
        details: serviceInternalId
      });
      log.debug({
        title: "nsItemInternalId",
        details: nsItemInternalId
      });
      log.debug({
        title: "nsItemRate",
        details: nsItemRate
      });
      log.debug({
        title: "app_job_group_internal_id",
        details: app_job_group_internal_id
      });
      log.debug({
        title: "jobInternalId",
        details: jobInternalId
      });

      //Get the current week's date range in Sydney time (Monday to Sunday).
      var sydney_today = format.parse({
        value: format.format({
          value: new Date(),
          type: format.Type.DATE,
          timezone: format.Timezone.AUSTRALIA_SYDNEY
        }),
        type: format.Type.DATE
      });

      var day_of_week = sydney_today.getDay(); // 0=Sunday, 1=Monday, ...
      var days_since_monday = (day_of_week + 6) % 7;

      var week_start_date = new Date(sydney_today);
      week_start_date.setDate(week_start_date.getDate() - days_since_monday);
      week_start_date.setHours(0, 0, 0, 0);

      var week_end_date = new Date(week_start_date);
      week_end_date.setDate(week_end_date.getDate() + 6);
      week_end_date.setHours(23, 59, 59, 999);

      service_start_date = format.format({
        value: week_start_date,
        type: format.Type.DATE
      });
      service_end_date = format.format({
        value: week_end_date,
        type: format.Type.DATE
      });

      // try {
      //If start of the loop, increment the qty of the item and add the item and rate into arrays
      if (isNullorEmpty(oldAppJobGroupInternalId)) {
        //Add the job internal id into the array
        jobInternalIdArray.push(jobInternalId);
      } else if (
        oldCustomerInternalId == customer_internal_id &&
        oldAppJobGroupInternalId == app_job_group_internal_id
      ) {
        log.audit({
          title: "Same Customer & same app job group id",
          details: ""
        });
        jobInternalIdArray.push(jobInternalId);
      } else if (
        oldCustomerInternalId == customer_internal_id &&
        oldAppJobGroupInternalId != app_job_group_internal_id
      ) {
        log.audit({
          title: "Same Customer & different app job group id",
          details: "Store new invoice line item for the new service"
        });
        log.debug({
          title: "oldNSItemInternalId",
          details: oldNSItemInternalId
        });
        log.debug({
          title: "oldNSItemRate",
          details: oldNSItemRate
        });

        //Check if there are any invoice line items to be added before creating a new invoice and if it is there, increment the quantity of the existing items instead of adding duplicate items.
        var itemFound = false;
        for (var i = 0; i < invoiceLineItems.length; i++) {
          if (invoiceLineItems[i].item == oldNSItemInternalId) {
            invoiceLineItems[i].quantity += 1;
            itemFound = true;
            break;
          }
        }

        if (!itemFound) {
          invoiceLineItems.push({
            item: oldNSItemInternalId,
            rate: oldNSItemRate,
            quantity: 1
          });
        }
        log.debug({
          title: "invoiceLineItems",
          details: invoiceLineItems
        });
        jobInternalIdArray.push(jobInternalId);
      } else if (
        oldCustomerInternalId != customer_internal_id &&
        !isNullorEmpty(oldCustomerInternalId)
      ) {
        log.audit({
          title: "Different Customer",
          details:
            "Create new invoice for the previous customer and reset the arrays for the new customer"
        });
        log.debug({
          title: "oldNSItemInternalId",
          details: oldNSItemInternalId
        });
        log.debug({
          title: "oldNSItemRate",
          details: oldNSItemRate
        });
        //Check if there are any invoice line items to be added before creating a new invoice and if it is there, increment the quantity of the existing items instead of adding duplicate items.
        var itemFound = false;
        for (var i = 0; i < invoiceLineItems.length; i++) {
          if (invoiceLineItems[i].item == oldNSItemInternalId) {
            invoiceLineItems[i].quantity += 1;
            itemFound = true;
            break;
          }
        }

        if (!itemFound) {
          invoiceLineItems.push({
            item: oldNSItemInternalId,
            rate: oldNSItemRate,
            quantity: 1
          });
        }

        //log invoiceLineItems
        log.audit({
          title: "invoiceLineItems",
          details: JSON.stringify(invoiceLineItems)
        });

        //Create Invoice
        log.audit({
          title: "START OF INVOICE CREATION",
          details: ""
        });

        recInvoice = record.create({
          type: record.Type.INVOICE,
          isDynamic: true
        });

        recInvoice.setValue({ fieldId: "customform", value: 116 });
        recInvoice.setValue({
          fieldId: "entity",
          value: oldCustomerInternalId
        });

        recInvoice.setValue({
          fieldId: "department",
          value: record
            .load({ type: record.Type.PARTNER, id: oldFranchisee })
            .getValue({ fieldId: "department" })
        });
        recInvoice.setValue({
          fieldId: "location",
          value: record
            .load({ type: record.Type.PARTNER, id: oldFranchisee })
            .getValue({ fieldId: "location" })
        });

        //Set the invoice date to  the date the schedule script is going to run, which is Saturday. This is to be used in the invoice date field.
        recInvoice.setValue({
          fieldId: "trandate",
          value: getDateStoreNS()
        });
        recInvoice.setValue({
          fieldId: "custbody_dont_update_trandate",
          value: true
        });
        recInvoice.setValue({
          fieldId: "custbody_inv_date_range_from",
          value: getWeekStartNS()
        });
        recInvoice.setValue({
          fieldId: "custbody_inv_date_range_to",
          value: getWeekEndNS()
        });

        recInvoice.setValue({ fieldId: "partner", value: oldFranchisee });

        recInvoice.setValue({ fieldId: "terms", value: 1 });

        //go through the array and add the items to the invoice
        for (var i = 0; i < invoiceLineItems.length; i++) {
          recInvoice.selectNewLine({
            sublistId: "item"
          });

          recInvoice.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "item",
            value: invoiceLineItems[i].item
          });

          recInvoice.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "quantity",
            value: invoiceLineItems[i].quantity
          });

          recInvoice.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "rate",
            value: invoiceLineItems[i].rate
          });
          recInvoice.commitLine({ sublistId: "item" });
        }

        var invoiceId = recInvoice.save({
          enableSourcing: true,
          ignoreMandatoryFields: true
        });

        //go through the job ids to update the field invoiceable to yes and store the invoice id in the job record
        for (var i = 0; i < jobInternalIdArray.length; i++) {
          var job_record = record.load({
            type: "customrecord_job",
            id: jobInternalIdArray[i]
          });
          job_record.setValue({
            fieldId: "custrecord_job_invoice",
            value: invoiceId
          });
          job_record.setValue({
            fieldId: "custrecord_job_date_reviewed",
            value: getDateStoreNS()
          });
          job_record.setValue({
            fieldId: "custrecord_job_date_inv_finalised",
            value: getDateStoreNS()
          });
          job_record.setValue({
            fieldId: "custrecord_job_date_invoiced",
            value: getDateStoreNS()
          });
          job_record.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
          });
        }

        var reschedule = task.create({
          taskType: task.TaskType.SCHEDULED_SCRIPT,
          deploymentId: "customdeploy2",
          params: null,
          scriptId: "customscript_ss2_create_weekly_invoices"
        });

        var reschedule_id = reschedule.submit();

        log.audit({
          title: "Reschedule Return",
          details: reschedule_id
        });

        return false;
      }

      oldCustomerInternalId = customer_internal_id;
      oldServiceInternalId = serviceInternalId;
      oldAppJobGroupInternalId = app_job_group_internal_id;
      oldNSItemInternalId = nsItemInternalId;
      oldNSItemRate = nsItemRate;
      oldFranchisee = franchisee;
      jobCount++;
      return true;
    });

    if (jobCount > 0) {
      log.audit({
        title: "Out of loop",
        details: "Create new invoice for the last customer and reset the arrays"
      });

      //Check if there are any invoice line items to be added before creating a new invoice and if it is there, increment the quantity of the existing items instead of adding duplicate items.
      var itemFound = false;
      for (var i = 0; i < invoiceLineItems.length; i++) {
        if (invoiceLineItems[i].item == oldNSItemInternalId) {
          invoiceLineItems[i].quantity += 1;
          itemFound = true;
          break;
        }
      }

      if (!itemFound) {
        invoiceLineItems.push({
          item: oldNSItemInternalId,
          rate: oldNSItemRate,
          quantity: 1
        });
      }

      //log invoiceLineItems
      log.audit({
        title: "invoiceLineItems",
        details: JSON.stringify(invoiceLineItems)
      });

      //Create Invoice
      log.audit({
        title: "START OF INVOICE CREATION",
        details: ""
      });

      recInvoice = record.create({
        type: record.Type.INVOICE,
        isDynamic: true
      });

      recInvoice.setValue({ fieldId: "customform", value: 116 });
      recInvoice.setValue({
        fieldId: "entity",
        value: oldCustomerInternalId
      });

      recInvoice.setValue({
        fieldId: "department",
        value: record
          .load({ type: record.Type.PARTNER, id: oldFranchisee })
          .getValue({ fieldId: "department" })
      });
      recInvoice.setValue({
        fieldId: "location",
        value: record
          .load({ type: record.Type.PARTNER, id: oldFranchisee })
          .getValue({ fieldId: "location" })
      });

      //Set the invoice date to  the date the schedule script is going to run, which is Saturday. This is to be used in the invoice date field.
      recInvoice.setValue({
        fieldId: "trandate",
        value: getDateStoreNS()
      });
      recInvoice.setValue({
        fieldId: "custbody_dont_update_trandate",
        value: true
      });
      recInvoice.setValue({
        fieldId: "custbody_inv_date_range_from",
        value: getWeekStartNS()
      });
      recInvoice.setValue({
        fieldId: "custbody_inv_date_range_to",
        value: getWeekEndNS()
      });
      recInvoice.setValue({
        fieldId: "custbody_inv_type",
        value: 16
      });

      recInvoice.setValue({ fieldId: "partner", value: oldFranchisee });

      recInvoice.setValue({ fieldId: "terms", value: 7 });

      //go through the array and add the items to the invoice
      for (var i = 0; i < invoiceLineItems.length; i++) {
        recInvoice.selectNewLine({
          sublistId: "item"
        });

        recInvoice.setCurrentSublistValue({
          sublistId: "item",
          fieldId: "item",
          value: invoiceLineItems[i].item
        });

        recInvoice.setCurrentSublistValue({
          sublistId: "item",
          fieldId: "quantity",
          value: invoiceLineItems[i].quantity
        });

        recInvoice.setCurrentSublistValue({
          sublistId: "item",
          fieldId: "rate",
          value: invoiceLineItems[i].rate
        });
        recInvoice.commitLine({ sublistId: "item" });
      }

      var invoiceId = recInvoice.save({
        enableSourcing: true,
        ignoreMandatoryFields: true
      });

      //go through the job ids to update the field invoiceable to yes and store the invoice id in the job record
      for (var i = 0; i < jobInternalIdArray.length; i++) {
        var job_record = record.load({
          type: "customrecord_job",
          id: jobInternalIdArray[i]
        });
        job_record.setValue({
          fieldId: "custrecord_job_invoice",
          value: invoiceId
        });
        job_record.setValue({
          fieldId: "custrecord_job_date_reviewed",
          value: getDateStoreNS()
        });
        job_record.setValue({
          fieldId: "custrecord_job_date_inv_finalised",
          value: getDateStoreNS()
        });
        job_record.setValue({
          fieldId: "custrecord_job_date_invoiced",
          value: getDateStoreNS()
        });
        job_record.save({
          enableSourcing: true,
          ignoreMandatoryFields: true
        });
      }
    }
  }

  function getDate() {
    var date = new Date();
    date.setHours(date.getHours() + 17);
    date = format.format({ value: date, type: format.Type.DATE });

    return date;
  }

  function invoice_date() {
    var date = new Date();

    var month = date.getMonth(); //Months 0 - 11
    var day = date.getDate();
    var year = date.getFullYear();

    //If allocator run on the first day of the month, it takes the last month as the filter
    if (day == 1 || day == 2 || day == 3 || day == 4 || day == 5) {
      if (month == 0) {
        month = 11;
        year = year - 1;
      } else {
        month = month - 1;
      }
    }

    // var firstDay = new Date(year, (month), 1);
    var lastDay = new Date(year, month + 1, 0);

    return format.format({ value: lastDay, type: format.Type.DATE });
  }

  function service_start_end_date(date_finalised) {
    var split_date = date_finalised.split("/");

    var date = new Date();
    var firstDay = new Date(date.getFullYear(), parseInt(split_date[1]) - 1, 1);
    var lastDay = new Date(date.getFullYear(), split_date[1], 0);

    var service_range = [];

    service_range[0] = format.format({
      value: firstDay,
      type: format.Type.DATE
    });
    service_range[1] = format.format({
      value: lastDay,
      type: format.Type.DATE
    });

    return service_range;
  }

  function getDateStoreNS() {
    var date = new Date();
    if (date.getHours() > 6) {
      date.setDate(date.getDate() + 1);
    }

    format.format({
      value: date,
      type: format.Type.DATE,
      timezone: format.Timezone.AUSTRALIA_SYDNEY
    });

    return date;
  }

  function getSydneyNow() {
    var serverDate = new Date();

    // Convert server time to a Sydney date-time string matching user preferences
    var sydneyString = format.format({
      value: serverDate,
      type: format.Type.DATETIME,
      timezone: format.Timezone.AUSTRALIA_SYDNEY
    });

    // Grab just the date segment before the time component space
    var datePartOnly = sydneyString.split(" ")[0];

    // Safely parse it back into a backend native Date object
    return format.parse({
      value: datePartOnly,
      type: format.Type.DATE
    });
  }

  function getWeekStartNS() {
    var date = getSydneyNow();
    var dayOfWeek = date.getDay();

    // JavaScript treats Sunday as 0. Shift to make Monday the start.
    var distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    date.setDate(date.getDate() + distanceToMonday);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getWeekEndNS() {
    var date = getSydneyNow();
    var dayOfWeek = date.getDay();

    // Calculate the distance to the upcoming Sunday
    var distanceToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    date.setDate(date.getDate() + distanceToSunday);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function isNullorEmpty(strVal) {
    return (
      strVal == null ||
      strVal == "" ||
      strVal == "null" ||
      strVal == undefined ||
      strVal == "undefined" ||
      strVal == "- None -"
    );
  }

  return {
    execute: invoiceCreation
  };
});
