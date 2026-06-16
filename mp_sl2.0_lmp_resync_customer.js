/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * Author:               Ankith Ravindran
 * Created on:           Fri May 22 2026
 * Modified on:          Fri May 22 2026 07:59:52
 * SuiteScript Version:  2.0
 * Description:          Suitelet API to create a lead in LocalMile and sending out an email notification to the lead contact to create their profile. Test Lead
 *
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

    if (context.request.method === "GET") {
      var todayDate = new Date();
      var yesterdayDate = new Date(todayDate);

      var emailTo = "";
      var contactFirstName = "";
      var contactLastName = "";

      log.audit({
        title: "todayDate",
        details: todayDate
      });

      log.debug({
        title: "context.request.parameters",
        details: context.request.parameters
      });

      var internalid = context.request.parameters.customerInternalId;

      //Load Customer Record
      var customerRecord = record.load({
        type: record.Type.CUSTOMER,
        id: internalid,
        isDynamic: true
      });

      log.debug({
        title: "customerRecord",
        details: JSON.stringify(customerRecord)
      });

      var localMileSync = customerRecord.getValue({
        fieldId: "custentity_localmile_sync"
      });

      var dateLeadEntered = customerRecord.getValue({
        fieldId: "custentity_date_lead_entered"
      });
      var customerEntityId = customerRecord.getValue({
        fieldId: "entityid"
      });
      var companyName = customerRecord.getValue({
        fieldId: "companyname"
      });
      var franchisee = customerRecord.getText({
        fieldId: "partner"
      });
      var franchiseeInternalID = customerRecord.getValue({
        fieldId: "partner"
      });
      var partnerRecord = record.load({
        type: record.Type.PARTNER,
        id: franchiseeInternalID
      });
      var franchiseeTerritoryJSON = partnerRecord.getValue({
        fieldId: "custentity_zee_territory_json"
      });
      var zeeSuburbMappingJSON = [];
      var zeeJSON = JSON.parse(franchiseeTerritoryJSON);
      zeeJSON.forEach(function (suburb) {
        zeeSuburbMappingJSON.push(suburb);
      });

      var franchiseeNominatedAPID = partnerRecord.getValue({
        fieldId: "custentity_ap_nominated_corp_po"
      });

      if (!isNullorEmpty(franchiseeNominatedAPID)) {
        //Load NCL
        var nclRecord = record.load({
          type: "customrecord_ap_lodgment_location",
          id: franchiseeNominatedAPID
        });

        var apName = nclRecord.getValue({
          fieldId: "name"
        });
        var apAddr1 = nclRecord.getValue({
          fieldId: "custrecord_ap_lodgement_addr1"
        });
        var apStreet = nclRecord.getValue({
          fieldId: "custrecord_ap_lodgement_addr2"
        });
        var apSuburb = nclRecord.getValue({
          fieldId: "custrecord_ap_lodgement_suburb"
        });
        var apState = nclRecord.getText({
          fieldId: "custrecord_ap_lodgement_site_state"
        });
        var apPostcode = nclRecord.getValue({
          fieldId: "custrecord_ap_lodgement_postcode"
        });
        var apLatitude = nclRecord.getValue({
          fieldId: "custrecord_ap_lodgement_lat"
        });
        var apLongitude = nclRecord.getValue({
          fieldId: "custrecord_ap_lodgement_long"
        });
      }

      var customerPhone = customerRecord.getValue({
        fieldId: "phone"
      });
      var customerEmail = customerRecord.getValue({
        fieldId: "email"
      });
      var customerServiceEmail = customerRecord.getValue({
        fieldId: "custentity_email_service"
      });

      var customerSalesRep = customerRecord.getText({
        fieldId: "salesrep"
      });

      var shippingAddress1 = customerRecord.getValue({
        fieldId: "billaddr1"
      });
      var shippingAddress2 = customerRecord.getValue({
        fieldId: "billaddr2"
      });
      var shippingCity = customerRecord.getValue({
        fieldId: "shipcity"
      });
      var shippingStateProvince = customerRecord.getValue({
        fieldId: "shipstate"
      });
      var shippingZip = customerRecord.getValue({
        fieldId: "shipzip"
      });

      //Get Active Sales Record
      //Search Name: All Active Sales Records
      var allSalesRecordSearch = search.load({
        type: "customrecord_sales",
        id: "customsearch_all_sales_records_2"
      });
      allSalesRecordSearch.filters.push(
        search.createFilter({
          name: "internalid",
          join: "custrecord_sales_customer",
          operator: search.Operator.ANYOF,
          values: internalid
        })
      );

      var allSalesRecordSearchResultSet = allSalesRecordSearch.run().getRange({
        start: 0,
        end: 1
      });

      var salesRecordInternalId = null;
      var salesRecordLastAssigned = null;
      var salesRecordLastAssignedText = null;
      if (allSalesRecordSearchResultSet.length == 1) {
        salesRecordInternalId = allSalesRecordSearchResultSet[0].getValue({
          name: "internalid"
        });
        salesRecordLastAssignedText = allSalesRecordSearchResultSet[0].getText({
          name: "custrecord_sales_assigned"
        });
        salesRecordLastAssigned = allSalesRecordSearchResultSet[0].getValue({
          name: "custrecord_sales_assigned"
        });
      }

      //!No need to create a service record since we just need to create on an adhoc basis when the customer books a job from LocalMile, since the rate is dynamic based on the delivery address. The rate is got from LocalMile via the API during booking.

      //Create the customerDetails2 JSON to be sent to LocalMile.Plus Firebase Database. Needs to match above example.
      var updateCustomerDetails = {};
      updateCustomerDetails.address1 = shippingAddress1;
      updateCustomerDetails.city = shippingCity;
      updateCustomerDetails.companyName = companyName;
      updateCustomerDetails.customerEmail = customerEmail;
      updateCustomerDetails.customerPhone = customerPhone;
      updateCustomerDetails.customerServiceEmail = customerServiceEmail;
      updateCustomerDetails.franchisee = franchiseeInternalID;
      updateCustomerDetails.franchiseeTerritoryJSON = [];
      zeeSuburbMappingJSON.forEach(function (suburb) {
        var stringValue =
          suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
        updateCustomerDetails.franchiseeTerritoryJSON.push(stringValue);
      });

      updateCustomerDetails.state = shippingStateProvince;
      updateCustomerDetails.street = shippingAddress2;
      updateCustomerDetails.zip = shippingZip;
      updateCustomerDetails.apName = apName;
      updateCustomerDetails.apAddr1 = apAddr1;
      updateCustomerDetails.apStreet = apStreet;
      updateCustomerDetails.apSuburb = apSuburb;
      updateCustomerDetails.apState = apState;
      updateCustomerDetails.apPostcode = apPostcode;
      updateCustomerDetails.apLatitude = apLatitude;
      updateCustomerDetails.apLongitude = apLongitude;

      log.debug({
        title: "updateCustomerDetails",
        details: updateCustomerDetails
      });

      //TODO: Create account in LocalMile.Plus Application
      var firebaseCreateURL =
        "https://localmile-plus.web.app/api/v1/companies/" + internalid;

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";
      apiHeaders["x-api-key"] =
        "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";
      var responseUpdateCompaniesCollection = https.request({
        method: https.Method.PATCH,
        url: firebaseCreateURL,
        body: JSON.stringify(updateCustomerDetails),
        headers: apiHeaders
      });

      var myresponseUpdateCompaniesCollection_body =
        responseUpdateCompaniesCollection.body;
      var myresponseUpdateCompaniesCollection_code =
        responseUpdateCompaniesCollection.code;

      log.debug({
        title: "LocalMile Plus API Response Code",
        details: myresponseUpdateCompaniesCollection_code
      });
      log.debug({
        title: "LocalMile Plus API Response Body",
        details: myresponseUpdateCompaniesCollection_body
      });

      var responseObj = JSON.parse(myresponseUpdateCompaniesCollection_body);

      log.debug({
        title: "responseObj",
        details: responseObj
      });

      //Check if lead exisits in PP and if it does update the franchisee details
      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";
      apiHeaders["x-api-key"] = "454e75f843954875ccff72537d7702ba1ab6f65c";

      var firebaseCheckLeadExistsURL =
        "https://prospectplus.com.au/api/leads/check?id=" + internalid;

      var responseCheckLeadExist = https.request({
        method: https.Method.GET,
        url: firebaseCheckLeadExistsURL,
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

      //If it does exist, update the lead in Prospect+ (Firebase)
      if (responseCheckLeadExistObj.exists) {
        //Sycn with ProspectPlus as well.
        var updateCustomerDetailsinPP = {};
        updateCustomerDetailsinPP.address1 = shippingAddress1;
        updateCustomerDetailsinPP.city = shippingCity;
        updateCustomerDetailsinPP.companyName = companyName;
        updateCustomerDetailsinPP.customerEmail = customerEmail;
        updateCustomerDetailsinPP.customerPhone = customerPhone;
        updateCustomerDetailsinPP.customerServiceEmail = customerServiceEmail;
        updateCustomerDetailsinPP.franchisee = franchisee;
        updateCustomerDetailsinPP.franchiseeTerritoryJSON = [];
        updateCustomerDetailsinPP.state = shippingStateProvince;
        updateCustomerDetailsinPP.street = shippingAddress2;
        updateCustomerDetailsinPP.zip = shippingZip;

        log.debug({
          title: "updateCustomerDetailsinPP",
          details: updateCustomerDetailsinPP
        });

        var firebaseCreateURL =
          "https://prospectplus.com.au/api/leads/" + internalid;

        var apiHeaders = {};
        apiHeaders["Content-Type"] = "application/json";
        apiHeaders["x-api-key"] = "454e75f843954875ccff72537d7702ba1ab6f65c";
        var responseUpdateLeadsCollectionInPP = https.request({
          method: https.Method.PATCH,
          url: firebaseCreateURL,
          body: JSON.stringify(updateCustomerDetailsinPP),
          headers: apiHeaders
        });

        var myresponseUpdateLeadsCollectionInPP_body =
          responseUpdateLeadsCollectionInPP.body;
        var myresponseUpdateLeadsCollectionInPP_code =
          responseUpdateLeadsCollectionInPP.code;

        log.debug({
          title: "ProspectPlus API Response Code",
          details: myresponseUpdateLeadsCollectionInPP_code
        });
        log.debug({
          title: "ProspectPlus API Response Body",
          details: myresponseUpdateLeadsCollectionInPP_body
        });
      }

      var returnObj = {
        success: true,
        leadID: internalid,
        message: "Lead Synced to LocalMile & ProspectPlus",
        result: "Lead synced to LocalMile successfully"
      };

      log.debug({
        title: "returnObj",
        details: returnObj
      });
      //{"success":true,"localMilePlusAuthLink":"https://localmile.plus/activate/undefined","leadID":"1938360","message":"Lead Synced to LocalMile","result":"Lead synced to LocalMile successfully"}

      _sendJSResponse(context.request, context.response, returnObj);
    } else {
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

  return {
    onRequest: onRequest
  };
});

function getDialersWithMinCount(dialers, dialerCounts) {
  // Find the minimum count among all dialers
  var minCount = null;
  for (var i = 0; i < dialers.length; i++) {
    var count = dialerCounts[dialers[i]];
    if (minCount === null || count < minCount) {
      minCount = count;
    }
  }
  // Collect all dialers with the minimum count
  var eligibleDialers = [];
  for (var i = 0; i < dialers.length; i++) {
    if (dialerCounts[dialers[i]] === minCount) {
      eligibleDialers.push(dialers[i]);
    }
  }
  return eligibleDialers;
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
