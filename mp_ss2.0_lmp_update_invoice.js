/**

 * @NApiVersion 2.0
 * @NScriptType ScheduledScript
 *
 * Created on Fri Jul 10 2026
 * Modified on Fri Jul 10 2026
 * SuiteScript Version:  2.0
 * Description: 
 * Copyright (c) 2026 MailPlus Pty. Ltd.
 */

define([
  "N/task",
  "N/email",
  "N/runtime",
  "N/search",
  "N/record",
  "N/format",
  "N/https"
], function (task, email, runtime, search, record, format, https) {
  var main_JSON = "";
  var lpoName = "";
  var lpoContactFName = null;
  var lpoContactLName = null;
  var lpoContactEmail = null;
  var lpoContactPhone = null;

  function execute(context) {
    //Search: LocalMile.PLUS - Update Invoice Status:
    var lmpInvoiceListSearch = search.load({
      type: "customer",
      id: "customsearch_lmp_inv_to_sync_2"
    });

    var resultSetLMPInvoiceList = lmpInvoiceListSearch.run();

    var invoiceCounter = 0;

    resultSetLMPInvoiceList.each(function (searchResult) {
      //Customer Details
      var customerInternalId = searchResult.getValue({
        name: "internalid"
      });

      var invoiceInternalId = searchResult.getValue({
        name: "internalid",
        join: "transaction"
      });
      var invoiceNumber = searchResult.getValue({
        name: "tranid",
        join: "transaction"
      });

      var invoiceStatus = searchResult.getText({
        name: "statusref",
        join: "transaction"
      });

      //Log all the above fields for debugging purposes
      log.audit({
        title: "Invoice Details",
        details: {
          customerInternalId: customerInternalId,
          invoiceInternalId: invoiceInternalId,
          invoiceNumber: invoiceNumber,
          invoiceStatus: invoiceStatus
        }
      });

      var invoiceUpdateDetails = '{"fields": {';
      invoiceUpdateDetails +=
        '"status": {"stringValue": "' + invoiceStatus + '"}';
      invoiceUpdateDetails += "}}"; // Close fields and root object

      log.debug({
        title: "Constructed JSON for Firebase",
        details: invoiceUpdateDetails
      });

      var firebaseCheckInvoiceExistsURL =
        "https://localmile-plus.web.app/api/v1/companies/" +
        customerInternalId +
        "/invoices/" +
        invoiceNumber;

      log.debug({
        title: "Firebase Check Invoice Exists URL",
        details: firebaseCheckInvoiceExistsURL
      });

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";
      apiHeaders["x-api-key"] =
        "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

      log.debug({
        title: "API Headers",
        details: JSON.stringify(apiHeaders)
      });

      var response = https.request({
        method: https.Method.PUT,
        url: firebaseCheckInvoiceExistsURL,
        body: invoiceUpdateDetails,
        headers: apiHeaders
      });

      log.debug({
        title: "Firebase Check Invoice Exist Response",
        details: "Code: " + response.code + ", Body: " + response.body
      });

      //Success API Return
      /**
       * {
      "success": true,
      "message": "Invoice document updated successfully.",
      "invoiceId": "10492"
    }
       */

      //Update the Record only if successful response from Firebase
      var responseObj = JSON.parse(response.body);
      if (!responseObj.success) {
        log.error({
          title: "Firebase Update Failed",
          details: "Invoice update failed in Firebase. Skipping record update."
        });
      } else {
        log.audit({
          title: "Firebase Update Successful",
          details: "Invoice update succeeded in Firebase."
        });

        recInvoice = record.load({
          type: record.Type.INVOICE,
          id: invoiceInternalId,
          isDynamic: true
        });
        if (invoiceStatus == "Paid In Full") {
          recInvoice.setValue({
            fieldId: "custbody_inv_paid_synced",
            value: 1
          });
        }
        recInvoice.save();
      }

      invoiceCounter++;
      return true;
    });
  }
  return {
    execute: execute
  };

  function getDateStoreNS() {
    var date = new Date();
    // if (date.getHours() > 6) {
    //     date.setDate(date.getDate() + 1);
    // }

    format.format({
      value: date,
      type: format.Type.DATE,
      timezone: format.Timezone.AUSTRALIA_SYDNEY
    });

    return date;
  }

  // Shuffle dialers for initial randomness
  function shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  function removeDuplicates(arr) {
    var unique = [];
    for (var i = 0; i < arr.length; i++) {
      if (unique.indexOf(arr[i]) === -1) {
        unique.push(arr[i]);
      }
    }
    return unique;
  }

  // Pure JavaScript padStart implementation
  function padStartCustom(str, targetLength, padString) {
    str = String(str);
    padString = padString || " ";
    if (str.length >= targetLength) return str;
    var pad = "";
    while (pad.length < targetLength - str.length) {
      pad += padString;
    }
    pad = pad.slice(0, targetLength - str.length);
    return pad + str;
  }

  // Converts '1/5/2026' to 'YYYY-MM-DD' and gets billing month as 'YYYY-MM' (no moment.js)
  function parseDateAndBillingMonth(dateStr) {
    // Split by '/'
    var parts = dateStr.split("/");
    if (parts.length !== 3) return { formatted: "", billingMonth: "" };
    var day = padStartCustom(parts[0], 2, "0");
    var month = padStartCustom(parts[1], 2, "0");
    var year = parts[2];
    var formatted = year + "-" + month + "-" + day;
    var billingMonth = year + "-" + month;
    return { formatted: formatted, billingMonth: billingMonth };
  }

  /**
   * Is Null or Empty.
   *
   * @param {Object} strVal
   */
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
});
