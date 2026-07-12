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
    //Search: LocalMile.PLUS - Invoice List to be Synced
    var lmpInvoiceListSearch = search.load({
      type: "customer",
      id: "customsearch_lmp_inv_to_sync"
    });

    var resultSetLMPInvoiceList = lmpInvoiceListSearch.run();

    var oldInvoiceNumber = "";
    var oldInvoiceInternalId = "";
    var invoiceCounter = 0;
    var oldCustomerName = "";
    var oldFormattedInvoiceDate = "";
    var oldBillingMonth = "";
    var oldInvoiceAmount = 0;
    var lineItems = "";
    var oldInvoiceStatus = "";
    var oldCustomerInternalId = "";

    resultSetLMPInvoiceList.each(function (searchResult) {
      //Customer Details
      var customerInternalId = searchResult.getValue({
        name: "internalid"
      });
      var customerName = searchResult.getValue({
        name: "companyname"
      });
      var customerZee = searchResult.getValue({
        name: "partner"
      });

      //Invoice Details
      var invoiceDate = searchResult.getValue({
        name: "trandate",
        join: "transaction"
      });

      //Get formatted  date and billing month
      var parsedDate = parseDateAndBillingMonth(invoiceDate);
      var formattedInvoiceDate = parsedDate.formatted;
      var billingMonth = parsedDate.billingMonth;

      var invoiceInternalId = searchResult.getValue({
        name: "internalid",
        join: "transaction"
      });
      var invoiceNumber = searchResult.getValue({
        name: "tranid",
        join: "transaction"
      });
      var invoiceItem = searchResult.getText({
        name: "item",
        join: "transaction"
      });
      if (invoiceItem == "Outoging Mail Lodgement") {
        invoiceItem = "Site-to-LPO";
      } else if (invoiceItem == "Pick up and Delivery from PO") {
        invoiceItem = "LPO-to-Site";
      } else if (
        invoiceItem == "Package: Pickup from PO & Lodge Outgoing Mail"
      ) {
        invoiceItem = "Round Trip";
      }

      var invoiceItemDetails = searchResult.getText({
        name: "custcol1",
        join: "transaction"
      });
      var invoiceItemRate = searchResult.getValue({
        name: "rate",
        join: "transaction"
      });
      var invoiceItemQuantity = searchResult.getValue({
        name: "quantity",
        join: "transaction"
      });
      var invoiceItemAmount = searchResult.getValue({
        name: "amount",
        join: "transaction"
      });
      var invoiceAmount = searchResult.getValue({
        name: "total",
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
          customerName: customerName,
          customerZee: customerZee,
          invoiceDate: invoiceDate,
          formattedInvoiceDate: formattedInvoiceDate,
          billingMonth: billingMonth,
          invoiceNumber: invoiceNumber,
          invoiceItem: invoiceItem,
          invoiceItemDetails: invoiceItemDetails,
          invoiceItemRate: invoiceItemRate,
          invoiceItemQuantity: invoiceItemQuantity,
          invoiceItemAmount: invoiceItemAmount,
          invoiceAmount: invoiceAmount
        }
      });

      /** 
			 * Sample Line Items JSON structure to be sent to Firebase:
			 * {
				"itemId": "ITEM-0019",
				"description": "Standard Consignment Processing Base Rate",
				"rate": 1.20,
				"quantity": 1000,
				"amount": 1200.00
				},
			*/

      //Check if the invoice exists

      if (invoiceCounter == 0) {
        lineItems += '{"mapValue": {"fields": {';
        lineItems += '"itemId": {"stringValue": "' + invoiceItem + '"},';
        lineItems +=
          '"description": {"stringValue": "' + invoiceItemDetails + '"},';
        lineItems +=
          '"rate": {"doubleValue": ' + parseFloat(invoiceItemRate) + "},";
        lineItems +=
          '"quantity": {"doubleValue": ' +
          parseFloat(invoiceItemQuantity) +
          "},";
        lineItems +=
          '"amount": {"doubleValue": ' + parseFloat(invoiceItemAmount) + "}";
        lineItems += "}}},";
        log.audit({
          title: "First Line Item Added",
          details: lineItems
        });
      } else if (invoiceNumber == oldInvoiceNumber) {
        lineItems += '{"mapValue": {"fields": {';
        lineItems += '"itemId": {"stringValue": "' + invoiceItem + '"},';
        lineItems +=
          '"description": {"stringValue": "' + invoiceItemDetails + '"},';
        lineItems +=
          '"rate": {"doubleValue": ' + parseFloat(invoiceItemRate) + "},";
        lineItems +=
          '"quantity": {"doubleValue": ' +
          parseFloat(invoiceItemQuantity) +
          "},";
        lineItems +=
          '"amount": {"doubleValue": ' + parseFloat(invoiceItemAmount) + "}";
        lineItems += "}}},";
        log.audit({
          title: "Line Item Added",
          details: lineItems
        });
      } else if (invoiceNumber != oldInvoiceNumber) {
        log.debug({
          title: "lineItems",
          details:
            "Invoice Number: " + oldInvoiceNumber + ", Line Items: " + lineItems
        });

        if (lineItems.slice(-1) == ",") {
          lineItems = lineItems.slice(0, -1);
        }

        var invoiceDetails = '{"fields": {';
        invoiceDetails +=
          '"customerId": {"stringValue": "' + oldCustomerInternalId + '"},';
        invoiceDetails +=
          '"customerName": {"stringValue": "' + oldCustomerName + '"},';
        invoiceDetails +=
          '"invoiceNum": {"stringValue": "' + oldInvoiceNumber + '"},';
        invoiceDetails +=
          '"date": {"stringValue": "' + oldFormattedInvoiceDate + '"},';
        invoiceDetails +=
          '"billingMonth": {"stringValue": "' + oldBillingMonth + '"},'; // YYYY-MM
        invoiceDetails +=
          '"totalAmount": {"doubleValue": ' +
          parseFloat(oldInvoiceAmount) +
          "},";
        parseFloat(oldInvoiceAmount) + "},";
        invoiceDetails += '"line_items": {"arrayValue": {"values": [';
        invoiceDetails += lineItems;
        invoiceDetails += "]}},"; // Close arrayValue
        invoiceDetails +=
          '"status": {"stringValue": "' + oldInvoiceStatus + '"}';
        invoiceDetails += "}}"; // Close fields and root object
        log.debug({
          title: "Constructed JSON for Firebase",
          details: invoiceDetails
        });

        var firebaseCheckInvoiceExistsURL =
          "https://localmile-plus.web.app/api/v1/companies/" +
          oldCustomerInternalId +
          "/invoices/" +
          oldInvoiceInternalId +
          "/exists";

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
          method: https.Method.GET,
          url: firebaseCheckInvoiceExistsURL,
          body: invoiceDetails,
          headers: apiHeaders
        });

        log.debug({
          title: "Firebase Check Invoice Exist Response",
          details: "Code: " + response.code + ", Body: " + response.body
        });

        var responseCheckInvoiceExistObj = JSON.parse(response.body);
        if (!responseCheckInvoiceExistObj.exists) {
          log.audit({
            title: "Invoice does not exist in Firebase",
            details: "Creating new invoice document in Firebase"
          });

          var firebaseCreateInvoiceURL =
            "https://localmile-plus.web.app/api/v1/companies/" +
            oldCustomerInternalId +
            "/invoices";

          log.debug({
            title: "Firebase Create Invoice URL",
            details: firebaseCreateInvoiceURL
          });

          var apiHeaders = {};
          apiHeaders["Content-Type"] = "application/json";
          apiHeaders["x-api-key"] =
            "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

          var responseCreateInvoice = https.request({
            method: https.Method.POST,
            url: firebaseCreateInvoiceURL,
            body: invoiceDetails,
            headers: apiHeaders
          });
          log.debug({
            title: "Firebase Create Invoice Response",
            details:
              responseCreateInvoice.code +
              ", Body: " +
              responseCreateInvoice.body
          });
        } else {
          log.audit({
            title: "Invoice already exists in Firebase",
            details: "No action taken for invoice document in Firebase"
          });
        }

        recInvoice = record.load({
          type: record.Type.INVOICE,
          id: oldInvoiceInternalId,
          isDynamic: true
        });
        recInvoice.setValue({
          fieldId: "custbody_synced_with_firebase",
          value: 1
        });
        recInvoice.save();

        //Reset line items for new invoice
        lineItems = "";
        oldInvoiceAmount = 0;
        oldCustomerName = "";
        oldFormattedInvoiceDate = "";
        oldBillingMonth = "";

        lineItems += '{"mapValue": {"fields": {';
        lineItems += '"itemId": {"stringValue": "' + invoiceItem + '"},';
        lineItems +=
          '"description": {"stringValue": "' + invoiceItemDetails + '"},';
        lineItems +=
          '"rate": {"doubleValue": ' + parseFloat(invoiceItemRate) + "},";
        lineItems +=
          '"quantity": {"doubleValue": ' +
          parseFloat(invoiceItemQuantity) +
          "},";
        lineItems +=
          '"amount": {"doubleValue": ' + parseFloat(invoiceItemAmount) + "}";
        lineItems += "}}},";
      }

      oldInvoiceInternalId = invoiceInternalId;
      oldInvoiceNumber = invoiceNumber;
      oldCustomerName = customerName;
      oldFormattedInvoiceDate = formattedInvoiceDate;
      oldBillingMonth = billingMonth;
      oldInvoiceAmount = invoiceAmount;
      oldInvoiceStatus = invoiceStatus;
      oldCustomerInternalId = customerInternalId;
      invoiceCounter++;
      return true;
    });

    if (invoiceCounter > 0) {
      log.debug({
        title: "lineItems",
        details:
          "Invoice Number: " + oldInvoiceNumber + ", Line Items: " + lineItems
      });

      if (lineItems.slice(-1) == ",") {
        lineItems = lineItems.slice(0, -1);
      }

      var invoiceDetails = '{"fields": {';
      invoiceDetails +=
        '"customerId": {"stringValue": "' + oldCustomerInternalId + '"},';
      invoiceDetails +=
        '"customerName": {"stringValue": "' + oldCustomerName + '"},';
      invoiceDetails +=
        '"invoiceNum": {"stringValue": "' + oldInvoiceNumber + '"},';
      invoiceDetails +=
        '"date": {"stringValue": "' + oldFormattedInvoiceDate + '"},';
      invoiceDetails +=
        '"billingMonth": {"stringValue": "' + oldBillingMonth + '"},'; // YYYY-MM
      invoiceDetails +=
        '"totalAmount": {"doubleValue": ' + parseFloat(oldInvoiceAmount) + "},";
      invoiceDetails += '"line_items": {"arrayValue": {"values": [';
      invoiceDetails += lineItems;
      invoiceDetails += "]}},"; // Close arrayValue
      invoiceDetails += '"status": {"stringValue": "' + oldInvoiceStatus + '"}';
      invoiceDetails += "}}"; // Close fields and root object

      log.debug({
        title: "Constructed JSON for Firebase",
        details: invoiceDetails
      });

      var firebaseCheckInvoiceExistsURL =
        "https://localmile-plus.web.app/api/v1/companies/" +
        oldCustomerInternalId +
        "/invoices/" +
        oldInvoiceInternalId +
        "/exists";

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";
      apiHeaders["x-api-key"] =
        "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

      var response = https.request({
        method: https.Method.GET,
        url: firebaseCheckInvoiceExistsURL,
        body: invoiceDetails,
        headers: apiHeaders
      });

      log.debug({
        title: "Firebase Check Invoice Exist Response",
        details: "Code: " + response.code + ", Body: " + response.body
      });

      var responseCheckInvoiceExistObj = JSON.parse(response.body);
      if (!responseCheckInvoiceExistObj.exists) {
        log.audit({
          title: "Invoice does not exist in Firebase",
          details: "Creating new invoice document in Firebase"
        });

        var firebaseCreateInvoiceURL =
          "https://localmile-plus.web.app/api/v1/companies/" +
          oldCustomerInternalId +
          "/invoices";

        log.debug({
          title: "Firebase Create Invoice URL",
          details: firebaseCreateInvoiceURL
        });

        var apiHeaders = {};
        apiHeaders["Content-Type"] = "application/json";
        apiHeaders["x-api-key"] =
          "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

        var responseCreateInvoice = https.request({
          method: https.Method.POST,
          url: firebaseCreateInvoiceURL,
          body: invoiceDetails,
          headers: apiHeaders
        });

        log.debug({
          title: "Firebase Create Invoice Response",
          details:
            responseCreateInvoice.code + ", Body: " + responseCreateInvoice.body
        });
      } else {
        log.audit({
          title: "Invoice already exists in Firebase",
          details: "No action taken for invoice document in Firebase"
        });
      }

      recInvoice = record.load({
        type: record.Type.INVOICE,
        id: oldInvoiceInternalId,
        isDynamic: true
      });
      recInvoice.setValue({
        fieldId: "custbody_synced_with_firebase",
        value: 1
      });
      recInvoice.save();
    }
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
