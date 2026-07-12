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

  function invoiceCreation() {
    //NetSuite Search: LocalMile.PLUS - Jobs Completed - To be Invoiced
    var searched_summary = search.load({
      id: "customsearch_lmp_jobs_complete_to_invoic",
      type: "customrecord_jobgroup"
    });

    var resultSet_summary = searched_summary.run();

    var oldCustomerInternalId = null;
    var oldServiceInternalId = null;
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

      log.debug({
        title: "week_start_date",
        details: week_start_date
      });
      log.debug({
        title: "week_end_date",
        details: week_end_date
      });

      service_start_date = format.format({
        value: week_start_date,
        type: format.Type.DATE
      });
      service_end_date = format.format({
        value: week_end_date,
        type: format.Type.DATE
      });

      log.debug({
        title: "service_start_date",
        details: service_start_date
      });
      log.debug({
        title: "service_end_date",
        details: service_end_date
      });

      // try {
      //If start of the loop, increment the qty of the item and add the item and rate into arrays
      if (
        isNullorEmpty(oldServiceInternalId) &&
        isNullorEmpty(oldCustomerInternalId)
      ) {
        nsItemTotalQty++;
        invoiceLineItems.push({
          item: nsItemInternalId,
          rate: nsItemRate,
          quantity: nsItemTotalQty
        });
        //Add the job internal id into the array
        jobInternalIdArray.push(jobInternalId);
      } else if (
        oldServiceInternalId == serviceInternalId &&
        oldCustomerInternalId == customer_internal_id
      ) {
        nsItemTotalQty++;
        //Update the quantity of the item in the array
        for (var i = 0; i < invoiceLineItems.length; i++) {
          if (invoiceLineItems[i].item == nsItemInternalId) {
            invoiceLineItems[i].quantity = nsItemTotalQty;
          }
        }
        jobInternalIdArray.push(jobInternalId);
      } else if (
        oldCustomerInternalId == customer_internal_id &&
        oldServiceInternalId != serviceInternalId
      ) {
        log.audit({
          title: "Same Customer but different service",
          details: "Store new invoice line item for the new service"
        });

        //Add the new item and rate into the array and increment the quantity of the item
        nsItemTotalQty = 1;
        invoiceLineItems.push({
          item: nsItemInternalId,
          rate: nsItemRate,
          quantity: nsItemTotalQty
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
        //Create Invoice
        log.debug({
          title: "START OF INVOICE CREATION",
          details: ""
        });

        log.audit({
          title: getDateStoreNS(),
          details: "getDateStoreNS()"
        });
        log.audit({
          title: getWeekStartNS(),
          details: "getWeekStartNS()"
        });
        log.audit({
          title: getWeekEndNS(),
          details: "getWeekEndNS()"
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
      // } catch (e) {
      //   log.error({
      //     title: "invoiceCreation loop error",
      //     details: e
      //   });
      // }

      log.debug({
        title: "invoiceLineItems",
        details: JSON.stringify(invoiceLineItems)
      });

      oldCustomerInternalId = customer_internal_id;
      oldServiceInternalId = serviceInternalId;
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

      log.debug({
        title: "jobCount",
        details: jobCount
      });
      log.debug({
        title: "invoiceLineItems",
        details: JSON.stringify(invoiceLineItems)
      });
      log.debug({
        title: "jobInternalIdArray",
        details: JSON.stringify(jobInternalIdArray)
      });

      //Create Invoice
      log.debug({
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

  function updateJobs(
    customer_internal_id,
    invoiceId,
    service_start_date,
    service_end_date,
    franchisee,
    from_invoice,
    special_customer_internal_id,
    zee_text
  ) {
    var count_loop_job = 0;

    var strFormula =
      "COALESCE({custrecord_job_service.custrecord_service_franchisee},{custrecord_job_group.custrecord_jobgroup_franchisee},{custrecord_job_franchisee},'')";

    if (from_invoice == "Yes") {
      var searched_alljobs = search.load({
        id: "customsearch_job_invoicing_jobs",
        type: "customrecord_job"
      });

      var zee_record = record.load({
        type: record.Type.PARTNER,
        id: franchisee
      });

      zee_text = zee_record.getValue({ fieldId: "entitytitle" });
    } else {
      var searched_alljobs = search.load({
        id: "customsearch_job_inv_process_job_all",
        type: "customrecord_job"
      });
    }

    searched_alljobs.filters.push(
      search.createFilter({
        name: "custrecord_job_customer",
        operator: search.Operator.IS,
        values: customer_internal_id
      })
    );

    if (!isNullorEmpty(special_customer_internal_id)) {
      log.debug({
        title: "special_customer_internal_id",
        details: special_customer_internal_id
      });

      searched_alljobs.filters.push(
        search.createFilter({
          name: "custrecord_job_special_customer",
          operator: search.Operator.IS,
          values: special_customer_internal_id
        })
      );
    } else {
      searched_alljobs.filters.push(
        search.createFilter({
          name: "custrecord_job_special_customer",
          operator: search.Operator.IS,
          values: "@NONE@"
        })
      );
    }
    searched_alljobs.filters.push(
      search.createFilter({
        name: "formulatext",
        operator: search.Operator.IS,
        values: zee_text,
        formula: strFormula
      })
    );

    if (
      !isNullorEmpty(service_start_date) &&
      !isNullorEmpty(service_end_date)
    ) {
      searched_alljobs.filters.push(
        search.createFilter({
          name: "custrecord_job_date_scheduled",
          operator: search.Operator.ONORAFTER,
          values: format.parse({
            value: service_start_date,
            type: format.Type.DATE
          })
        })
      );

      searched_alljobs.filters.push(
        search.createFilter({
          name: "custrecord_job_date_scheduled",
          operator: search.Operator.ONORBEFORE,
          values: format.parse({
            value: service_end_date,
            type: format.Type.DATE
          })
        })
      );
    }

    var resultSet_alljobs = searched_alljobs.run();

    var reschedule;

    resultSet_alljobs.each(function (searchResult_alljobs) {
      var usage_loopstart_job = ctx.getRemainingUsage();
      count_loop_job++;

      //nlapiLogExecution('DEBUG', 'START ---> usage remianing per loop of job update', ctx.getRemainingUsage());
      try {
        if (ctx.getRemainingUsage() <= usage_threshold) {
          log.audit({
            title: "switch inside Job Update",
            details: "switch inside Job Update"
          });
          log.audit({
            title: "Job Update | Customer",
            details: customer_internal_id
          });
          log.audit({ title: "Job Update | Invoice", details: invoiceId });

          var params = {
            custscript_customer_id: customer_internal_id.toString(),
            custscript_invoiceid: invoiceId.toString(),
            custscript_prev_deployment: ctx.getDeploymentId(),
            custscript_service_start_date: service_start_date.toString(),
            custscript_service_end_date: service_end_date.toString(),
            custscript_zee: franchisee.toString(),
            custscript_special_customer_id: special_customer_internal_id,
            custscript_error_customers: error_customers.join(","),
            custscript_error_special_customers:
              error_specialCustomers.join(","),
            custscript_zee_text: zee_text
          };

          var reschedule = task.create({
            taskType: task.TaskType.SCHEDULED_SCRIPT,
            scriptId: prev_inv_deploy,
            deploymentId: adhoc_inv_deploy,
            params: params
          });

          reschedule.submit();

          log.audit({
            title: "Reschedule Return",
            details: reschedule
          });
          if (reschedule == false) {
            return false;
          }
        }

        var job_id = searchResult_alljobs.getValue("internalid");
        var invoiceable_yes_no = searchResult_alljobs.getValue(
          "custrecord_job_invoiceable"
        );

        var job_record = record.load({
          type: "customrecord_job",
          id: job_id
        });

        // job_record.getFieldValue('custrecord_job_date_invoiced') != getDate()
        if (
          isNullorEmpty(
            job_record.getValue({ fieldId: "custrecord_job_date_invoiced" })
          ) &&
          isNullorEmpty(
            job_record.getValue({ fieldId: "custrecord_job_invoice" })
          )
        ) {
          if (from_invoice == "Yes") {
            var jobGroupStatus = job_record.getValue({
              fieldId: "custrecord_job_group_status"
            });
            var jobInvoiceable = job_record.getValue({
              fieldId: "custrecord_job_invoiceable"
            });
            var jobCat = job_record.getValue({
              fieldId: "custrecord_job_service_category"
            });
            var packageStatus = job_record.getValue({
              fieldId: "custrecord_package_status"
            });

            if (isNullorEmpty(jobInvoiceable)) {
              if (!isNullorEmpty(packageStatus)) {
                if (packageStatus == 1 || isNullorEmpty(packageStatus)) {
                  // Job Group Status is Null for Extras and Jobs Created in NS
                  job_record.setValue({
                    fieldId: "custrecord_job_invoiceable",
                    value: 1
                  });
                } else {
                  job_record.setValue({
                    fieldId: "custrecord_job_invoiceable",
                    value: 2
                  });
                }
              } else {
                if (
                  jobGroupStatus == "Completed" ||
                  isNullorEmpty(jobGroupStatus)
                ) {
                  // Job Group Status is Null for Extras and Jobs Created in NS
                  job_record.setValue({
                    fieldId: "custrecord_job_invoiceable",
                    value: 1
                  });
                } else {
                  job_record.setValue({
                    fieldId: "custrecord_job_invoiceable",
                    value: 2
                  });
                }
              }
            }
            job_record.setValue({
              fieldId: "custrecord_job_invoice",
              value: invoiceId
            });
            job_record.setValue({
              fieldId: "custrecord_job_date_reviewed",
              value: getDate()
            });
            job_record.setValue({
              fieldId: "custrecord_job_date_inv_finalised",
              value: getDate()
            });
            job_record.setValue({
              fieldId: "custrecord_job_date_invoiced",
              value: getDate()
            });
            job_record.setValue({
              fieldId: "custrecord_job_invoice_custom",
              value: 1
            });
          } else {
            if (
              !isNullorEmpty(
                job_record.getValue({ fieldId: "custrecord_job_date_reviewed" })
              ) &&
              !isNullorEmpty(
                job_record.getValue({
                  fieldId: "custrecord_job_date_inv_finalised"
                })
              )
            ) {
              job_record.setValue({
                fieldId: "custrecord_job_invoice",
                value: invoiceId
              });
              job_record.setValue({
                fieldId: "custrecord_job_date_invoiced",
                value: getDate()
              });
              job_record.setValue({
                fieldId: "custrecord_job_invoice_custom",
                value: 2
              });
            } else {
              var body =
                "Customer: " +
                customer_internal_id +
                " | Job: " +
                job_id +
                "cannot be updated because Date Review & Date Invoice Finalised is Empty.";

              email.send({
                author: 112209,
                body: body,
                recipients: [
                  "ankith.ravindran@mailplus.com.au",
                  "willian.suryadharma@mailplus.com.au"
                ],
                subject:
                  "Invoice Creation - Customer: " +
                  customer_internal_id +
                  " cannot update Job"
              });

              //WS log:
              log.error({
                title: "Job #: " + count_loop_job + " | Job: " + job_id + ".",
                details: "ERROR: JOB X UPDATED - Inv & Date Invoice not empty."
              });

              return false;
            }
          }

          job_record.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
          });

          //WS Log:
          log.debug({
            title: "Job #: " + count_loop_job + " | Job: " + job_id + ".",
            details: usage_loopstart_job - ctx.getRemainingUsage()
          });
        } else {
          var body =
            "Customer: " +
            customer_internal_id +
            " | Job: " +
            job_id +
            "cannot be updated because Invoice ID and Date Invoice is not Empty.";

          email.send({
            author: 409635,
            body: body,
            recipients: [
              "ankith.ravindran@mailplus.com.au",
              "willian.suryadharma@mailplus.com.au"
            ],
            subject:
              "Invoice Creation - Customer: " +
              customer_internal_id +
              " cannot update Job"
          });

          //WS log:
          log.error({
            title: "Job #: " + count_loop_job + " | Job: " + job_id + ".",
            details: "ERROR: JOB X UPDATED - Inv & Date Invoice not empty."
          });

          return false;
        }
      } catch (e) {
        error_customers[error_customers.length] = customer_internal_id;

        var message = "";
        message += "Customer Internal ID: " + customer_internal_id + "</br>";
        message +=
          "Customer:  <a href ='https://1048144.app.netsuite.com/app/common/entity/custjob.nl?id=" +
          customer_internal_id +
          "'> View Customer </a></br>";
        message +=
          "----------------------------------------------------------------------------------</br>";
        message +=
          "Job: <a href ='https://1048144.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=941&id=" +
          job_id +
          "'> View Job </a></br>";
        message +=
          "----------------------------------------------------------------------------------</br>";
        message += e;

        email.send({
          author: 409635,
          body: message,
          recipients: [
            "ankith.ravindran@mailplus.com.au",
            "willian.suryadharma@mailplus.com.au"
          ],
          subject:
            "Invoice Creation - Customer: " +
            customer_internal_id +
            " cannot update Job"
        });
      }

      return true;
    });

    //WS Log:
    log.debug({
      title: "--> END | update job function",
      details: ctx.getRemainingUsage()
    });

    if (reschedule != false) {
      return true;
    } else {
      return false;
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
