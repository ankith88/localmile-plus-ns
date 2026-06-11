/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Wed Oct 08 2025
 * Modified on:          Wed Oct 08 2025 08:34:44
 * SuiteScript Version:  2.0
 * Description:          New Leads that signs in to LocalMile Accepts T&Cs
 *
 * Copyright (c) 2025 MailPlus Pty. Ltd.
 */

define([
  "N/ui/serverWidget",
  "N/email",
  "N/runtime",
  "N/search",
  "N/record",
  "N/http",
  "N/log",
  "N/redirect",
  "N/format",
  "N/https"
], function (
  ui,
  email,
  runtime,
  search,
  record,
  http,
  log,
  redirect,
  format,
  https
) {
  var role = 0;
  var userId = 0;
  var zee = 0;

  function onRequest(context) {
    var baseURL = "https://system.na2.netsuite.com";
    if (runtime.EnvType == "SANDBOX") {
      baseURL = "https://system.sandbox.netsuite.com";
    }
    userId = runtime.getCurrentUser().id;
    role = runtime.getCurrentUser().role;

    var lpoLeadBDMAssigned = null;

    var date = new Date();
    var date_now = format.parse({
      value: date,
      type: format.Type.DATE
    });
    var time_now = format.parse({
      value: date,
      type: format.Type.TIMEOFDAY
    });

    var zeeName = null;
    var zeeEmail = null;
    var zeePhone = null;

    if (context.request.method === "GET") {
      log.debug({
        title: "context.request.parameters",
        details: context.request.parameters
      });

      //	{"ns-at":"AAEJ7tMQOzkqNGaA1Ro_--dH10JMwE-qORiwvdQdTZlS6NNYv1g","customerid":"1935168","compid":"1048144","script":"2182","deploy":"1"}

      //Get the Customer Internal ID
      var customerInternalId = context.request.parameters.customer_id;
      var customerRecord = record.load({
        type: "customer",
        id: customerInternalId
      });

      var zeeId = customerRecord.getValue({
        fieldId: "partner"
      });

      customerRecord.setValue({
        fieldId: "custentity_terms_conditions_agree_date",
        value: getDateStoreNS()
      });
      customerRecord.setValue({
        fieldId: "custentity_terms_conditions_agree",
        value: 1
      });
      customerRecord.setValue({
        fieldId: "entitystatus",
        value: 83 //Customer - LocalMile Pending
      });
      customerInternalId = customerRecord.save();

      //Update Status of Lead in Prospect+
      //Check if Lead exists  in Prospect+ (Firebase) - If exists, update the status to "LocalMile Pending"

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";
      apiHeaders["x-api-key"] = "454e75f843954875ccff72537d7702ba1ab6f65c";

      var firebaseDeleteZeeURL =
        "https://prospectplus.com.au/api/leads/check?id=" + customerInternalId;

      var responseCheckLeadExist = https.request({
        method: https.Method.GET,
        url: firebaseDeleteZeeURL,
        headers: apiHeaders // Make sure this includes your 'x-api-key'
      });

      log.debug({
        title: "Firebase Check Lead Exist Response",
        details:
          "Code: " +
          responseCheckLeadExist.code +
          ", Body: " +
          responseCheckLeadExist.body
      });

      var responseCheckLeadExistObj = JSON.parse(responseCheckLeadExist.body);

      if (responseCheckLeadExistObj.exists) {
        var customerDetails2 = {};
        customerDetails2.customerStatus = "LocalMile Pending";
        customerDetails2.netsuiteLeadStatus = "Customer - LocalMile Pending";
        customerDetails2.localMileTermsAccepted = true;

        var apiHeaders = {};
        apiHeaders["Content-Type"] = "application/json";
        apiHeaders["x-api-key"] = "454e75f843954875ccff72537d7702ba1ab6f65c";

        var firebaseDeleteZeeURL =
          "https://prospectplus.com.au/api/leads/" + customerInternalId;

        var responseCheckLeadExist = https.request({
          method: https.Method.PATCH,
          url: firebaseDeleteZeeURL,
          headers: apiHeaders, // Make sure this includes your 'x-api-key'
          body: JSON.stringify(customerDetails2)
        });

        log.debug({
          title: "Firebase Update Lead Status Response",
          details:
            "Code: " +
            responseCheckLeadExist.code +
            ", Body: " +
            responseCheckLeadExist.body
        });
      }

      var returnObj = {
        success: true,
        message: "Status Updated Successfully"
      };

      log.audit({
        title: "Final Return",
        details: JSON.stringify(returnObj)
      });
      _sendJSResponse(context.request, context.response, returnObj);
    }
  }

  function _sendJSResponse(request, response, respObject) {
    // response.setContentType("JAVASCRIPT");
    // response.setHeader('Access-Control-Allow-Origin', '*');
    var callbackFcn = request.jsoncallback || request.callback;
    if (callbackFcn) {
      response.writeLine({
        output: callbackFcn + "(" + JSON.stringify(respObject) + ");"
      });
    } else response.writeLine({ output: JSON.stringify(respObject) });
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

  function getStateId(state) {
    var state_id;

    switch (state) {
      case "NSW":
        state_id = 1;
        break;
      case "QLD":
        state_id = 2;
        break;
      case "VIC":
        state_id = 3;
        break;
      case "SA":
        state_id = 4;
        break;
      case "TAS":
        state_id = 5;
        break;
      case "ACT":
        state_id = 6;
        break;
      case "WA":
        state_id = 7;
        break;
      case "NT":
        state_id = 8;
        break;
      case "NZ":
        state_id = 9;
        break;
    }

    return state_id;
  }

  function areDatesEqual(dateStr1, dateStr2) {
    // Expects both dates in "YYYY-MM-DD" format
    return dateStr1 === dateStr2;
  }

  /**
   * @description Function to check if a service exists in the service list.
   * @author Ankith Ravindran (AR)
   * @date 17/06/2025
   * @param {*} data
   * @param {*} service
   * @returns {*}
   */
  function getServiceRate(serviceList, serviceName) {
    // serviceList: array of objects with 'name' and 'rate' properties
    // serviceName: string to check (case-insensitive)
    for (var i = 0; i < serviceList.length; i++) {
      if (serviceList[i].name == serviceName) {
        return { rate: serviceList[i].rate, id: serviceList[i].id };
      }
    }
    return null; // Not found
  }

  function pad(s) {
    return s < 10 ? "0" + s : s;
  }

  function isNullorEmpty(strVal) {
    return (
      strVal == null ||
      strVal == "" ||
      strVal == "null" ||
      strVal == undefined ||
      strVal == "undefined" ||
      strVal == "- None -" ||
      strVal == " "
    );
  }

  function arrayOfStringsToIntegers(arr) {
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      var num = parseInt(arr[i], 10);
      if (!isNaN(num)) {
        result.push(num);
      }
    }
    return result;
  }

  function isArrayAlt(variable) {
    return Array.isArray
      ? Array.isArray(variable)
      : Object.prototype.toString.call(variable) === "[object Array]";
  }

  return {
    onRequest: onRequest
  };
});
