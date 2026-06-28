/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Tue May 05 2026
 * Modified on:          Tue May 05 2026 17:33:55
 * SuiteScript Version:  2.0
 * Description:
 *
 * Copyright (c) 2026 MailPlus Pty. Ltd.
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
  "N/https",
  "N/encode"
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
  https,
  encode
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

      //	{"date":"2026-06-16","auspost_first_name":"Australia","auspost_email":"no-reply@auspost.com.au","service_pmpo_rate":"15","auspost_company":"ALEXANDRIA BUSINESS HUB","auspost_last_name":"Post","service_ampo_internal_id":"null","service_h2h_rate":"null","script":"2649","service_pmpo_internal_id":"134164","deploy":"1","frequency":"null","firstName":"","service_ampo_rate":"null","compid":"1048144","job_id":"M49UuhjJVblqVdMwJR4i","parent_id":"","service":"site-to-australia post","ns-at":"AAEJ7tMQX4gDftlZvyZi8scPrWJRKTOWGovx9I5Cz06qXdzpiRU","service_h2h_internal_id":"null","is_free_job":"false","customer_id":"2005972","email":"","auspost_phone":"13 13 18"}

      //{"date":"2026-06-17","auspost_email":"no-reply@auspost.com.au","user_last_name":"null","service_ampo_internal_id":"null","service_pmpo_internal_id":"134164","deploy":"1","frequency":"null","user_first_name":"null","compid":"1048144","user_phone":"null","is_free_job":"false","email":"ankith88+testpud2@gmail.com","auspost_phone":"13 13 18","user_email":"null","auspost_first_name":"Australia","service_pmpo_rate":"15","auspost_company":"ALEXANDRIA BUSINESS HUB","auspost_last_name":"Post","service_h2h_rate":"null","script":"2649","firstName":"Info","service_ampo_rate":"null","job_id":"S7PFnsi6YJV1Ory5plah","parent_id":"","service":"site-to-australia post","ns-at":"AAEJ7tMQX4gDftlZvyZi8scPrWJRKTOWGovx9I5Cz06qXdzpiRU","service_h2h_internal_id":"null","customer_id":"2005972"}

      var originalCustomerInternalIdFromLPODB =
        context.request.parameters.customer_id;

      log.debug({
        title: "originalCustomerInternalIdFromLPODB",
        details: originalCustomerInternalIdFromLPODB
      });

      var customerRecord = record.load({
        type: "customer",
        id: originalCustomerInternalIdFromLPODB
      });
      var business_name = customerRecord.getValue({
        fieldId: "companyname"
      });

      var partnerID = customerRecord.getValue({
        fieldId: "partner"
      });

      //Get Contact Details
      // NetSuite Search: SALESP - Contacts
      var searched_contacts = search.load({
        id: "customsearch_salesp_contacts",
        type: "contact"
      });

      searched_contacts.filters.push(
        search.createFilter({
          name: "internalid",
          join: "CUSTOMER",
          operator: search.Operator.ANYOF,
          values: originalCustomerInternalIdFromLPODB
        })
      );
      resultSetContacts = searched_contacts.run();

      var serviceContactResult = resultSetContacts.getRange({
        start: 0,
        end: 1
      });

      var primaryContactInternalID = "";
      var customerContactFirstName = "";
      var customerContactLastName = "";
      var customerContactEmail = "";
      var customerContactPhone = "";
      if (serviceContactResult.length == 1) {
        primaryContactInternalID = serviceContactResult[0].getValue({
          name: "internalid"
        });
        customerContactFirstName = serviceContactResult[0].getValue({
          name: "firstname"
        });
        customerContactLastName = serviceContactResult[0].getValue({
          name: "lastname"
        });
        customerContactEmail = serviceContactResult[0].getValue({
          name: "email"
        });
        customerContactPhone = serviceContactResult[0].getValue({
          name: "phone"
        });
      }

      var customerPartnerRecord = record.load({
        type: "partner",
        id: partnerID
      });

      var partnerName = customerPartnerRecord.getValue({
        fieldId: "companyname"
      });
      var mainContactName = customerPartnerRecord.getValue({
        fieldId: "custentity3"
      });
      var partnerPhone = customerPartnerRecord.getValue({
        fieldId: "custentity2"
      });
      var partnerEmail = customerPartnerRecord.getValue({
        fieldId: "email"
      });

      partnerPhone = partnerPhone.replace(/ /g, "");
      partnerPhone = partnerPhone.slice(1);
      partnerPhone = "+61" + partnerPhone;

      var localMilePlusJobId = context.request.parameters.job_id;
      var servicePmpoInternalId =
        context.request.parameters.service_pmpo_internal_id;
      var servicePmpoRate = context.request.parameters.service_pmpo_rate;
      var serviceAmpoInternalId =
        context.request.parameters.service_ampo_internal_id;
      var serviceAmpoRate = context.request.parameters.service_ampo_rate;
      var serviceH2hInternalId =
        context.request.parameters.service_h2h_internal_id;
      var serviceH2hRate = context.request.parameters.service_h2h_rate;

      var zee_id = null;

      var localMilePlusJobDate = context.request.parameters.date;
      var prettyDate = formatDateToLongReadable(localMilePlusJobDate);
      var localMilePlusJobFrequency = context.request.parameters.frequency;
      var localMilePlusService = null;
      var serviceInternalId = null;
      //Convert service to uppercase.
      var appJobGroupServiceText = "";
      if (!isNullorEmpty(servicePmpoInternalId) && servicePmpoRate > 0) {
        appJobGroupServiceText = "PMPO";
        localMilePlusService = "Site-to-Australia Post";
        serviceInternalId = servicePmpoInternalId;
      } else if (!isNullorEmpty(serviceAmpoInternalId) && serviceAmpoRate > 0) {
        appJobGroupServiceText = "AMPO";
        localMilePlusService = "Australia Post-to-Site";
        serviceInternalId = serviceAmpoInternalId;
      } else if (!isNullorEmpty(serviceH2hInternalId) && serviceH2hRate > 0) {
        appJobGroupServiceText = "H2H";
        localMilePlusService = "Site-to-Site";
        serviceInternalId = serviceH2hInternalId;
      }

      var contactEmail = context.request.parameters.email;
      var contactPhone = context.request.parameters.phone;
      var contactFirstName = context.request.parameters.firstName;

      if (isNullorEmpty(zee_id)) {
        zee_id = partnerID;
      }

      //Send Email to LPO and end customer letting them know the job request has been accepted by the franchisee.

      var emailToCustomerSubject =
        "Booking confirmed — " + " (" + localMilePlusService + ")";

      //Send Email to End Customer
      var emailToCustomerBody =
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MailPlus - Authenticate Your Access</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>body,html{margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:#f4f7f8;}.email-container{font-family:"Inter",system-ui,-apple-system,sans-serif;max-width:600px;margin:40px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(9,92,123,0.08);border:1px solid #e1e8ed;}.content{padding:45px 35px 35px 35px;color:#333333;line-height:1.6;}.greeting{font-size:22px;margin-bottom:12px;color:#095c7b;font-weight:700;letter-spacing:-0.5px;}.sub-text{font-size:15px;color:#556068;margin-bottom:25px;}.action-box{background-color:#f8fafb;border-radius:12px;padding:30px 20px;margin:25px 0;border-left:4px solid #EAF044;text-align:center;}.action-box-title{font-weight:600;color:#095c7b;margin-bottom:15px;font-size:13px;text-transform:uppercase;letter-spacing:1px;}.security-code{font-size:38px;font-weight:800;color:#095c7b;letter-spacing:6px;margin:10px 0;}.security-hint{font-size:13px;color:#718096;font-weight:500;margin-top:10px;}.button-container{text-align:center;margin:35px 0 20px 0;}.btn-primary{background-color:#EAF044;color:#095c7b !important;padding:16px 36px;text-decoration:none;font-weight:700;font-size:13px;border-radius:8px;display:inline-block;transition:all 0.2s ease-in-out;box-shadow:0 4px 14px rgba(234,240,68,0.4);text-transform:uppercase;letter-spacing:1px;}.btn-primary:hover{background-color:#dbe236;box-shadow:0 6px 18px rgba(234,240,68,0.5);transform:translateY(-1px);}.raw-link-text{font-size:13px;color:#718096;word-break:break-all;margin-top:25px;text-align:center;line-height:1.5;}.raw-link-text a{color:#095c7b;text-decoration:underline;}.branding-banner{background-color:#095c7b;padding:25px 20px;text-align:center;}.brand-logo{display:inline-block;vertical-align:middle;max-height:42px;width:auto;border:0;}.footer{background-color:#f8fafb;padding:30px 20px;text-align:center;font-size:12px;color:#718096;border-top:1px solid #edf2f7;}.footer p{margin:6px 0;line-height:1.5;}@media screen and (max-width:600px){.email-container{margin:10px auto;border-radius:8px;}.content{padding:35px 20px;}.greeting{font-size:20px;}.btn-primary{width:100%;box-sizing:border-box;padding:15px 20px;}.brand-logo{max-height:36px;}}.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head>';
      var year = new Date().getFullYear();
      //Email to LPO to let them know the job request has been accepted by the franchisee.

      emailToCustomerBody +=
        '<body><div class="email-container"><div class="content"><div class="greeting">Your booking is Confirmed</div><div class="sub-text"><p> Hello ' +
        contactFirstName +
        ",</p><p>Your MailPlus operator has confirmed your booking.</p></div>";
      //Job Details Section
      emailToCustomerBody +=
        '<div class="job-details"><div class="detail-row"><span class="detail-label">Reference:</span><span class="detail-value">' +
        localMilePlusJobId +
        '</span></div><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
        localMilePlusService +
        '</span></div><div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">' +
        prettyDate +
        "</span></div>";
      if (!isNullorEmpty(localMilePlusJobFrequency)) {
        emailToCustomerBody +=
          '<div class="detail-row"><span class="detail-label">Frequency:</span><span class="detail-value">' +
          localMilePlusJobFrequency +
          "</span></div></div>";

        emailToCustomerBody +=
          '<div class="reminder-note"><div class="icon">↻</div><p>Because this is a recurring service, we\'ll send you a quick reminder on the morning of each scheduled pickup day so you know to have your parcels ready. <strong>You don\'t need to do anything to confirm each visit</strong> — the schedule runs automatically.</p></div>';
      } else {
        emailToCustomerBody += "</div>";
      }

      emailToCustomerBody +=
        "<p>If anything changes — you don't need a pickup that day, or you'd like to add or remove a day from the schedule — just reply to this email and the MailPlus team will sort it out for you.</p><p>Thank you for using MailPlus. We look forward to helping with your logistics!</p>";

      emailToCustomerBody +=
        '<div class="branding-banner"><img src="https://lh3.googleusercontent.com/d/1hhLMkl8NmyhkhDT9jDg9AYIhbIRsjQQD" alt="MailPlus Logo" class="brand-logo"></div>';

      emailToCustomerBody +=
        '<div class="footer"><p><strong>MailPlus</strong> | Business logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;font-size:11px;color:#a0aec0;"> &copy; ' +
        year +
        " MailPlus. All rights reserved. <br> You are receiving this system communication as part of your registered account activation flow. </p></div></div>";

      emailToCustomerBody += "</body></html>";

      if (!isNullorEmpty(contactEmail)) {
        var sendOutEmailJSON = {
          from: "localmile@mailplus.com.au",
          to: contactEmail,
          cc: "",
          subject: emailToCustomerSubject,
          html: emailToCustomerBody,
          metadata: {
            customerId: originalCustomerInternalIdFromLPODB,
            jobId: localMilePlusJobId
          }
        };

        log.debug({
          title: "sendOutEmailJSON",
          details: JSON.stringify(sendOutEmailJSON)
        });

        var firebaseUpdateURL =
          "https://prospectplus.com.au/api/integrations/netsuite/send-email";

        var apiHeaders = {};
        apiHeaders["Content-Type"] = "application/json";

        var response = https.request({
          method: https.Method.POST,
          url: firebaseUpdateURL,
          body: JSON.stringify(sendOutEmailJSON),
          headers: apiHeaders
        });

        var myresponse_body = response.body;
        var myresponse_code = response.code;
      }

      log.audit({
        title:
          "job request acceptance email sent to customer with response from email API call",
        details:
          "Response Body: " +
          myresponse_body +
          ", Response Code: " +
          myresponse_code
      });

      //Send SMS

      var returnObj = {
        success: true,
        message: "Email sent successfully to end customer.",
        jobAcceptedCustInternalId: originalCustomerInternalIdFromLPODB,
        localMilePlusJobId: localMilePlusJobId,
        serviceInternalId: serviceInternalId
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
    response.setHeader("Access-Control-Allow-Origin", "*");
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

  function getOrdinalSuffix(day) {
    if (day % 100 >= 11 && day % 100 <= 13) {
      return "th";
    }

    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  }

  function formatDateToLongReadable(dateStr) {
    if (isNullorEmpty(dateStr)) {
      return "";
    }

    var parts = dateStr.split("-");
    if (parts.length !== 3) {
      return dateStr;
    }

    var year = parseInt(parts[0], 10);
    var monthIndex = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) {
      return dateStr;
    }

    var weekdayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ];

    var monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];

    // Use UTC to avoid timezone shifts that can change weekday/date unexpectedly.
    var parsedDate = new Date(Date.UTC(year, monthIndex, day));
    var weekday = weekdayNames[parsedDate.getUTCDay()];
    var month = monthNames[monthIndex];

    if (isNullorEmpty(weekday) || isNullorEmpty(month)) {
      return dateStr;
    }

    return (
      weekday + ", " + day + getOrdinalSuffix(day) + " " + month + " " + year
    );
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
