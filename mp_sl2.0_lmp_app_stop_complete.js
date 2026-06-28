/**
/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 28 2026
 * Modified on:          Tue Apr 28 2026 11:05:21
 * SuiteScript Version:  2.0
 * Description:           Suitelet script to handle stop completion by operator and update the status in Firebase, as well as send email notification to LPO.
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
  "N/https",
  "N/email",
  "N/url"
], function (
  ui,
  email,
  runtime,
  search,
  record,
  http,
  log,
  redirect,
  https,
  email,
  url
) {
  var role = 0;
  var userId = 0;
  var zee = 0;

  var localMileJobID = null;
  var localmilePlusJobID = null;
  var localMileJobCustomerInternalID = null;

  function onRequest(context) {
    var baseURL = "https://system.na2.netsuite.com";
    if (runtime.EnvType == "SANDBOX") {
      baseURL = "https://system.sandbox.netsuite.com";
    }
    userId = runtime.getCurrentUser().id;

    role = runtime.getCurrentUser().role;

    if (context.request.method === "GET") {
      log.debug({
        title: "context.request.parameters",
        details: context.request.parameters
      });

      //{"jobid":"29294939","compid":"1048144","ns-at":"AAEJ7tMQqWxV-IxJ7XgqmIEhRWB5hJ8yagkr0mxsAdPzko1qCQA","jobgroupid":"21187446","operatorid":"1363","extras[]":"","script":"2655","deploy":"1"}

      var jobId = context.request.parameters.jobid;
      var jobGroupJobIdString = context.request.parameters.jobgroupid;
      var jobGroupIdArray = jobGroupJobIdString.split("_");
      var jobGroupId = jobGroupIdArray[0];
      var operatorId = context.request.parameters.operatorid;
      var jobStatus = context.request.parameters.jobstatus;
      var incompleteReason = context.request.parameters.reason;

      log.debug({
        title: "jobGroupJobIdString",
        details: jobGroupJobIdString
      });
      log.debug({
        title: "jobId",
        details: jobId
      });
      log.debug({
        title: "jobGroupId",
        details: jobGroupId
      });
      log.debug({
        title: "operatorId",
        details: operatorId
      });
      log.debug({
        title: "jobStatus",
        details: jobStatus
      });

      //GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
      var tokenBody =
        '{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";

      var responseAccessToken = https.request({
        method: https.Method.POST,
        url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCEKfFKLTso-t3Lu6YV8XOpCCBF2az9Hcg",
        headers: apiHeaders,
        body: tokenBody
      });

      log.debug({
        title: "Firebase Access Token Response",
        details: responseAccessToken.body
      });

      var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

      var idToken = responseAccessTokenObj.idToken;
      // idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
      var refreshToken = responseAccessTokenObj.refreshToken;

      if (
        !isNullorEmpty(jobId) &&
        !isNullorEmpty(jobGroupId) &&
        !isNullorEmpty(operatorId) &&
        isNullorEmpty(incompleteReason)
      ) {
        //Get Franchisee Details from the Operator ID
        var operatorRecord = record.load({
          type: "customrecord_operator",
          id: operatorId
        });
        var zeeID = operatorRecord.getValue({
          fieldId: "custrecord_operator_franchisee"
        });

        //Load the App Job Group and get the Customer ID
        var app_job_group_rec = record.load({
          type: "customrecord_jobgroup",
          id: jobGroupId
        });
        var appJobGroupServiceInternalID = app_job_group_rec.getValue({
          fieldId: "custrecord_jobgroup_service"
        });
        var appJobGroupServiceText = app_job_group_rec.getText({
          fieldId: "custrecord_jobgroup_service"
        });
        if (appJobGroupServiceText == "AMPO") {
          appJobGroupServiceText = "AUSTRALIA POST - TO - SITE";
        } else if (appJobGroupServiceText == "PMPO") {
          appJobGroupServiceText = "SITE - TO - AUSTRALIA POST";
        }
        var appJobGroupCustomerInternalID = app_job_group_rec.getValue({
          fieldId: "custrecord_jobgroup_customer"
        });
        localMileJobCustomerInternalID = appJobGroupCustomerInternalID;
        var appJobGroupOperatosRejected = app_job_group_rec.getValue({
          fieldId: "custrecord_job_ops_rejected"
        });
        localMileJobID = app_job_group_rec.getValue({
          fieldId: "custrecord_jobgroup_prem_id"
        });
        localmilePlusJobID = app_job_group_rec.getValue({
          fieldId: "custrecord_lmp_job_id"
        });

        //Load the Lead Record to get the Parent ID and Company Name
        var leadRecord = record.load({
          type: "customer",
          id: appJobGroupCustomerInternalID
        });
        var leadCompanyName = leadRecord.getValue({
          fieldId: "companyname"
        });
        var leadCompanyEmail = leadRecord.getValue({
          fieldId: "custentity_email_service"
        });
        var custLinkedPartner = leadRecord.getValue({
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
            values: appJobGroupCustomerInternalID
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

        log.debug({
          title: "Customer Contact Details",
          details:
            "ID: " +
            primaryContactInternalID +
            ", Name: " +
            customerContactFirstName +
            " " +
            customerContactLastName +
            ", Email: " +
            customerContactEmail +
            ", Phone: " +
            customerContactPhone
        });

        log.debug({
          title: "Linked Partner ID",
          details: custLinkedPartner
        });

        //Load the App Job Record and update the customer & franchisee details
        var appJobRecord = record.load({
          type: "customrecord_job",
          id: jobId
        });
        appJobRecord.setValue({
          fieldId: "custrecord_job_status",
          value: 3 //Completed status
        });
        var serviceLeg = appJobRecord.getValue({
          fieldId: "custrecord_job_service_leg"
        });

        var appJobRecordId = appJobRecord.save({
          enableSourcing: true,
          ignoreMandatoryFields: true
        });

        log.debug({
          title: "serviceLeg",
          details: serviceLeg
        });

        //Search Name:LocalMile.PLUS - App Job Groups & App Jobs
        var localmilePlusAppJobGroupStatusSyncSearch = search.load({
          type: "customrecord_jobgroup",
          id: "customsearch_localmile_app_job_groups__8"
        });

        localmilePlusAppJobGroupStatusSyncSearch.filters.push(
          search.createFilter({
            name: "internalid",
            join: null,
            operator: search.Operator.ANYOF,
            values: jobGroupId
          })
        );

        var oldJobGroupInternalID = null;
        var oldCustomerInternalID = null;
        var jobGroupCount = 0;
        var oldLocalMileJobID = null;
        var appJobGroupStatusUpdate = null;
        var jobStatuses = [];

        var jobsStatus = "";

        localmilePlusAppJobGroupStatusSyncSearch
          .run()
          .each(function (searchResult) {
            var appJobStatus = searchResult.getText({
              name: "custrecord_job_status",
              join: "CUSTRECORD_JOB_GROUP"
            });
            var appJobCustomerInternalID = searchResult.getValue({
              name: "internalid",
              join: "CUSTRECORD_JOBGROUP_CUSTOMER"
            });
            var appJobGroupInternalID = searchResult.getValue({
              name: "internalid"
            });

            if (
              !isNullorEmpty(oldJobGroupInternalID) &&
              oldJobGroupInternalID != appJobGroupInternalID
            ) {
              log.debug({
                title: "jobStatuses",
                details: jobStatuses
              });

              var jobGroupStatusToBeUpdated = getJobGroupStatus(jobStatuses);

              log.debug({
                title: "jobGroupStatusToBeUpdated",
                details: jobGroupStatusToBeUpdated
              });

              var updateJobGroupStatusID = null;
              var updateFirebaseFinalSync = false;

              if (jobGroupStatusToBeUpdated == "Complete") {
                jobsStatus = "completed";
                updateJobGroupStatusID = 1; //Completed
                updateFirebaseFinalSync = true;
              } else if (jobGroupStatusToBeUpdated == "Partial") {
                jobsStatus = "in-progress";
                updateJobGroupStatusID = 2; //Partial
              } else if (jobGroupStatusToBeUpdated == "Incomplete") {
                jobsStatus = "incomplete";
                updateJobGroupStatusID = 3; //Incomplete
              }

              if (!isNullorEmpty(updateJobGroupStatusID)) {
                //Load the App Job Group and get the Customer ID
                var app_job_group_rec = record.load({
                  type: "customrecord_jobgroup",
                  id: oldJobGroupInternalID
                });
                app_job_group_rec.setValue({
                  fieldId: "custrecord_jobgroup_status",
                  value: updateJobGroupStatusID
                });
                var app_job_group_id = app_job_group_rec.save();

                log.audit({
                  title: "App Job Group Status Updated",
                  details:
                    "App Job Group ID: " +
                    app_job_group_id +
                    ", Status: " +
                    updateJobGroupStatusID
                });
              }
              jobStatuses = [];
              oldJobGroupInternalID = null;
              oldCustomerInternalID = null;
            }

            jobStatuses.push(appJobStatus);

            oldJobGroupInternalID = appJobGroupInternalID;
            oldCustomerInternalID = appJobCustomerInternalID;
            oldLocalMileJobID = localMileJobID;
            jobGroupCount++;
            return true;
          });

        if (jobGroupCount > 0) {
          log.debug({
            title: "jobStatuses",
            details: jobStatuses
          });

          var jobGroupStatusToBeUpdated = getJobGroupStatus(jobStatuses);

          log.debug({
            title: "jobGroupStatusToBeUpdated",
            details: jobGroupStatusToBeUpdated
          });

          var updateJobGroupStatusID = null;
          var updateFirebaseFinalSync = false;

          if (jobGroupStatusToBeUpdated == "Complete") {
            jobsStatus = "completed";
            updateJobGroupStatusID = 1; //Completed
            updateFirebaseFinalSync = true;
          } else if (jobGroupStatusToBeUpdated == "Partial") {
            jobsStatus = "in-progress";
            updateJobGroupStatusID = 2; //Partial
          } else if (jobGroupStatusToBeUpdated == "Incomplete") {
            jobsStatus = "incomplete";
            updateJobGroupStatusID = 3; //Incomplete
          }

          if (!isNullorEmpty(updateJobGroupStatusID)) {
            var app_job_group_rec = record.load({
              type: "customrecord_jobgroup",
              id: oldJobGroupInternalID
            });
            app_job_group_rec.setValue({
              fieldId: "custrecord_jobgroup_status",
              value: updateJobGroupStatusID
            });
            var app_job_group_id = app_job_group_rec.save();

            log.audit({
              title: "App Job Group Status Updated",
              details:
                "App Job Group ID: " +
                app_job_group_id +
                ", Status: " +
                updateJobGroupStatusID
            });
          }
        }

        if (!isNullorEmpty(localmilePlusJobID)) {
          //If Completed
          var updateJobCollectionJSON = {
            data: {
              jobId: String(localmilePlusJobID),
              collectionName: "jobs",
              status: "" + jobsStatus + "",
              stops: [{ index: parseInt(serviceLeg - 1), status: "completed" }]
            }
          };

          log.debug({
            title: "updateJobCollectionJSON",
            details: JSON.stringify(updateJobCollectionJSON)
          });

          var firebaseUpdateURL =
            "https://us-central1-localmile-plus.cloudfunctions.net/updateJobStatus";
          var apiHeaders = {};
          apiHeaders["Content-Type"] = "application/json";
          apiHeaders["Accept"] = "*/*";
          apiHeaders["Authorization"] = "Bearer " + idToken;

          var response = https.request({
            method: https.Method.POST,
            url: firebaseUpdateURL,
            body: JSON.stringify(updateJobCollectionJSON),
            headers: apiHeaders
          });

          var myresponse_body = response.body;
          var myresponse_code = response.code;

          log.debug({
            title: "myresponse_body",
            details: myresponse_body
          });

          log.debug({
            title: "myresponse_code",
            details: myresponse_code
          });

          //Send Email to Customer when only the delivery stop has been completed by the operator for the day.
          if (!isNullorEmpty(customerContactEmail) && serviceLeg == 2) {
            if (serviceLeg == 2) {
              var emailSubject = "Your Delivery has been Completed";
            } else if (serviceLeg == 1) {
              var emailSubject = "Your Pickup has been Completed";
            }

            var emailBody =
              "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head><body>";
            var year = new Date().getFullYear();
            //If stop 1 is completed then show the pickup has been completed, if stop 2 is completed then show the delivery has been completed. This can be identified based on the service leg value in the job record.
            if (serviceLeg == 1) {
              emailBody +=
                '<div class="email-container"><div class="header"><h1>localmile<span>.plus</span></h1></div><div class="content"><div class="greeting">Service Completed</div><p>Hi,</p><p>Great news! Your logistics pickup has been successfully completed by our team.</p>';
              //Job Details Section
              emailBody +=
                '<div class="job-details"><div class="detail-row"><span class="detail-label">Reference:</span><span class="detail-value">' +
                localmilePlusJobID +
                '</span></div><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
                appJobGroupServiceText +
                '</span></div><div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value">COMPLETED</span></div></div>';
            } else {
              emailBody +=
                '<div class="email-container"><div class="header"><h1>localmile<span>.plus</span></h1></div><div class="content"><div class="greeting">Service Completed</div><p>Hi,</p><p>Great news! Your logistics delivery has been successfully completed by our team.</p>';
              //Job Details Section
              emailBody +=
                '<div class="job-details"><div class="detail-row"><span class="detail-label">Reference:</span><span class="detail-value">' +
                localmilePlusJobID +
                '</span></div><div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">' +
                appJobGroupServiceText +
                '</span></div><div class="detail-row"><span class="detail-label">Status:</span><span class="detail-value">COMPLETED</span></div></div>';
            }

            emailBody +=
              '<div class="footer"><p><strong>localmile.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
              year +
              " localmile.plus. All rights reserved.</p></div></div></body></html>";

            var sendOutEmailJSON = {
              from: "localmile@mailplus.com.au",
              to: customerContactEmail,
              cc: "",
              subject: emailSubject,
              html: emailBody,
              metadata: {
                customerId: appJobGroupCustomerInternalID,
                jobId: localmilePlusJobID
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
        }

        var returnObj = {
          success: true,
          message: "App Job Group and Job statuses updated successfully.",
          result: "valid"
        };
      } else if (
        !isNullorEmpty(jobId) &&
        !isNullorEmpty(jobGroupId) &&
        !isNullorEmpty(operatorId) &&
        !isNullorEmpty(incompleteReason)
      ) {
        //Get Franchisee Details from the Operator ID
        var operatorRecord = record.load({
          type: "customrecord_operator",
          id: operatorId
        });
        var zeeID = operatorRecord.getValue({
          fieldId: "custrecord_operator_franchisee"
        });

        //Load the App Job Group and get the Customer ID
        var app_job_group_rec = record.load({
          type: "customrecord_jobgroup",
          id: jobGroupId
        });
        var appJobGroupServiceInternalID = app_job_group_rec.getValue({
          fieldId: "custrecord_jobgroup_service"
        });
        var appJobGroupServiceText = app_job_group_rec.getText({
          fieldId: "custrecord_jobgroup_service"
        });
        var appJobGroupCustomerInternalID = app_job_group_rec.getValue({
          fieldId: "custrecord_jobgroup_customer"
        });
        localMileJobCustomerInternalID = appJobGroupCustomerInternalID;
        var appJobGroupOperatosRejected = app_job_group_rec.getValue({
          fieldId: "custrecord_job_ops_rejected"
        });
        localMileJobID = app_job_group_rec.getValue({
          fieldId: "custrecord_jobgroup_prem_id"
        });
        localmilePlusJobID = app_job_group_rec.getValue({
          fieldId: "custrecord_lmp_job_id"
        });

        //Load the Lead Record to get the Parent ID and Company Name
        var leadRecord = record.load({
          type: "customer",
          id: appJobGroupCustomerInternalID
        });
        var leadCompanyName = leadRecord.getValue({
          fieldId: "companyname"
        });
        var custLinkedPartner = leadRecord.getValue({
          fieldId: "partner"
        });

        log.debug({
          title: "Customer Linked Partner",
          details: custLinkedPartner
        });

        //Load the App Job Record and update the customer & franchisee details
        var appJobRecord = record.load({
          type: "customrecord_job",
          id: jobId
        });
        appJobRecord.setValue({
          fieldId: "custrecord_job_status",
          value: 2 //Incomplete status
        });
        var serviceLeg = appJobRecord.getValue({
          fieldId: "custrecord_job_service_leg"
        });

        var appJobRecordId = appJobRecord.save({
          enableSourcing: true,
          ignoreMandatoryFields: true
        });

        if (!isNullorEmpty(localmilePlusJobID)) {
          //If Incomplete
          var updateJobCollectionJSON = {
            data: {
              jobId: String(localmilePlusJobID),
              collectionName: "jobs",
              status: "incomplete",
              stops: [{ index: parseInt(serviceLeg - 1), status: "incomplete" }]
            }
          };

          var firebaseUpdateURL =
            "https://us-central1-localmile-plus.cloudfunctions.net/updateJobStatus";
          var apiHeaders = {};
          apiHeaders["Content-Type"] = "application/json";
          apiHeaders["Accept"] = "*/*";
          apiHeaders["Authorization"] = "Bearer " + idToken;

          var response = https.request({
            method: https.Method.POST,
            url: firebaseUpdateURL,
            body: JSON.stringify(updateJobCollectionJSON),
            headers: apiHeaders
          });

          var myresponse_body = response.body;
          var myresponse_code = response.code;

          log.debug({
            title: "myresponse_body",
            details: myresponse_body
          });

          log.debug({
            title: "myresponse_code",
            details: myresponse_code
          });

          //Send Email to Customer when stop has been incompleted by the operator for the day.
          if (!isNullorEmpty(customerContactEmail)) {
            var emailBody =
              "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head>";
            if (serviceLeg == 1) {
              emailBody +=
                '</head><body><div class="email-container"><div class="header"><h1>localmile<span>.plus</span></h1></div><div class="content"><div class="greeting">Service Incomplete</div><p>Hi,</p><p>Unfortunately, your logistics pickup for <strong>' +
                leadCompanyName +
                '</strong> has been marked as incomplete by our team.</p><div class="status-box"><p style="margin:0;color:#095c7b;"><strong>Status:</strong> Incomplete</p></div><p style="font-size:14px;color:#666;">Please contact MailPlus for further assistance.</p></div>';
            } else {
              emailBody +=
                '</head><body><div class="email-container"><div class="header"><h1>localmile<span>.plus</span></h1></div><div class="content"><div class="greeting">Service Incomplete</div><p>Hi,</p><p>Unfortunately, your logistics delivery for <strong>' +
                leadCompanyName +
                '</strong> has been marked as incomplete by our team.</p><div class="status-box"><p style="margin:0;color:#095c7b;"><strong>Status:</strong> Incomplete</p></div><p style="font-size:14px;color:#666;">Please contact MailPlus for further assistance.</p></div>';
            }

            emailBody +=
              '<div class="footer"><p><strong>localmile.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
              year +
              " localmile.plus. All rights reserved.</p></div></div></body></html>";

            var sendOutEmailJSON = {
              from: "localmile@mailplus.com.au",
              to: customerContactEmail,
              cc: [
                "customerservice@mailplus.com.au",
                "dispatcher@mailplus.com.au"
              ],
              subject: emailSubject,
              html: emailBody,
              metadata: {
                customerId: appJobGroupCustomerInternalID,
                jobId: localmilePlusJobID
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

            log.debug({
              title: "myresponse_body",
              details: myresponse_body
            });

            log.debug({
              title: "myresponse_code",
              details: myresponse_code
            });

            //Send Email to End Customer when stop 2 has been completed by the operator for the day.
            if (!isNullorEmpty(leadCompanyEmail)) {
              if (serviceLeg == 2) {
                var emailSubject = "Your Delivery has not been Completed";
              } else if (serviceLeg == 1) {
                var emailSubject = "Your Pickup has not been Completed";
              }

              var emailBody =
                "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>.email-container{font-family: 'Fraunces', serif;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);border:1px solid #f0f0f0;}.header{background-color:#095c7b;padding:40px 20px;text-align:center;}.header h1{color:#ffffff;margin:0;font-size:24px;font-weight:300;letter-spacing:1px;}.header span{color:#EAF044;font-weight:bold;}.content{padding:40px 30px;color:#333333;line-height:1.6;}.greeting{font-size:18px;margin-bottom:20px;color:#095c7b;font-weight:bold;}.action-box{background-color:#f8fafb;border-radius:8px;padding:25px;margin:30px 0;border-left:4px solid #EAF044;}.button-container{text-align:center;margin:40px 0;}.btn-primary{background-color:#EAF044;color:#095c7b;padding:16px 32px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;transition:background 0.3s;box-shadow:0 4px 12px rgba(234,240,68,0.3);text-transform:uppercase;}.footer{background-color:#f4f7f8;padding:30px;text-align:center;font-size:12px;color:#999;}.footer p{margin:5px 0;}.job-details { background-color: #f8fafb; border-radius: 8px; padding: 25px; margin: 30px 0; border-left: 4px solid #EAF044; } .detail-row { margin-bottom: 12px; display: flex; } .detail-label { font-weight: bold; width: 120px; color: #666; font-size: 13px; text-transform: uppercase; } .detail-value { color: #095c7b; font-weight: 600; }</style></head>";
              var year = new Date().getFullYear();
              //If stop 1 is completed then show the pickup has been completed, if stop 2 is completed then show the delivery has been completed. This can be identified based on the service leg value in the job record.
              if (serviceLeg == 1) {
                emailBody +=
                  '</head><body><div class="email-container"><div class="header"><h1>localmile<span>.plus</span></h1></div><div class="content"><div class="greeting">Service Incomplete</div><p>Hi,</p><p>Unfortunately, your logistics pickup has been marked as incomplete by our team.</p><div class="status-box"><p style="margin:0;color:#095c7b;"><strong>Status:</strong> Incomplete</p></div><p style="font-size:14px;color:#666;">Please contact MailPlus for further assistance.</p></div>';
              } else {
                emailBody +=
                  '</head><body><div class="email-container"><div class="header"><h1>localmile<span>.plus</span></h1></div><div class="content"><div class="greeting">Service Incomplete</div><p>Hi,</p><p>Unfortunately, your logistics delivery has been marked as incomplete by our team.</p><div class="status-box"><p style="margin:0;color:#095c7b;"><strong>Status:</strong> Incomplete</p></div><p style="font-size:14px;color:#666;">Please contact MailPlus for further assistance.</p></div>';
              }

              emailBody +=
                '<div class="footer"><p><strong>localmile.plus</strong> | Local logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;">&copy; ' +
                year +
                " localmile.plus. All rights reserved.</p></div></div></body></html>";

              var sendOutEmailJSON = {
                to: leadCompanyEmail,
                cc: [
                  "michael.mcdaid@mailplus.com.au",
                  "kerry.oneill@mailplus.com.au",
                  "mailplusit@mailplus.com.au"
                ],
                subject: emailSubject,
                html: emailBody,
                metadata: {
                  lpoId: "",
                  customerId: appJobGroupCustomerInternalID,
                  jobId: localmilePlusJobID
                }
              };
              var sendOutEmailJSON = {
                from: "localmile@mailplus.com.au",
                to: customerContactEmail,
                cc: [
                  "customerservice@mailplus.com.au",
                  "dispatcher@mailplus.com.au"
                ],
                subject: emailSubject,
                html: emailBody,
                metadata: {
                  customerId: appJobGroupCustomerInternalID,
                  jobId: localmilePlusJobID
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
          }
        }
        var returnObj = {
          success: true,
          message: "App Job Group and Job statuses updated successfully.",
          result: "valid"
        };
      } else {
        //If any of the mandatory parameters are missing, return an error response
        //Also show which parameter is missing in the logs for debugging purposes

        if (isNullorEmpty(jobId)) {
          log.debug({
            title: "Missing Parameter",
            details: "jobId is missing or empty."
          });
        }
        if (isNullorEmpty(jobGroupId)) {
          log.debug({
            title: "Missing Parameter",
            details: "jobGroupId is missing or empty."
          });
        }
        if (isNullorEmpty(operatorId)) {
          log.debug({
            title: "Missing Parameter",
            details: "operatorId is missing or empty."
          });
        }

        var returnObj = {
          success: false,
          message: "Invalid input parameters.",
          result: "invalid"
        };
      }

      _sendJSResponse(context.request, context.response, returnObj);
    } else {
    }
  }

  /**
   * Compares job statuses in a job group and returns the job group status.
   * @param {Array} jobStatuses - Array of job status strings (e.g., ["Complete", "Scheduled", "Incomplete"])
   * @returns {string} - "Partial", "Incomplete", or "Complete"
   */
  function getJobGroupStatus(jobStatuses) {
    var hasComplete = false;
    var hasScheduled = false;
    var hasIncomplete = false;

    for (var i = 0; i < jobStatuses.length; i++) {
      var status = jobStatuses[i];
      if (status === "Completed") hasComplete = true;
      if (status === "Scheduled") hasScheduled = true;
      if (status === "Incomplete") hasIncomplete = true;
    }

    if (hasComplete && hasScheduled) {
      return "Partial";
    }
    if (hasIncomplete) {
      return "Incomplete";
    }
    if (hasComplete && !hasScheduled && !hasIncomplete) {
      return "Complete";
    }
    // Add more logic if needed for other combinations
    return "Unknown";
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

  function isArrayAlt(variable) {
    return Array.isArray
      ? Array.isArray(variable)
      : Object.prototype.toString.call(variable) === "[object Array]";
  }

  function arraysMatch(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;

    // Convert all values to strings for consistent comparison
    var arr1Sorted = arr1.map(String).sort();
    var arr2Sorted = arr2.map(String).sort();

    for (var i = 0; i < arr1Sorted.length; i++) {
      if (arr1Sorted[i] !== arr2Sorted[i]) {
        return false;
      }
    }
    return true;
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

  // Function to get current date and time in "dd/mm/yyyy HH:MM" format
  function getCurrentDateTime() {
    var now = new Date();
    now.setHours(now.getUTCHours() + 11);
    var day = customPadStart(now.getDate().toString(), 2, "0");
    var month = customPadStart((now.getMonth() + 1).toString(), 2, "0"); // Months are zero-based
    var year = now.getFullYear();
    var hours = customPadStart(now.getUTCHours().toString(), 2, "0");
    var minutes = customPadStart(now.getUTCMinutes().toString(), 2, "0");
    return day + "/" + month + "/" + year + " " + hours + ":" + minutes;
  }

  /**
   * @description Pads the current string with another string (multiple times, if needed) until the resulting string reaches the given length. The padding is applied from the start (left) of the current string.
   * @param {string} str - The original string to pad.
   * @param {number} targetLength - The length of the resulting string once the current string has been padded.
   * @param {string} padString - The string to pad the current string with. Defaults to a space if not provided.
   * @returns {string} The padded string.
   */
  function customPadStart(str, targetLength, padString) {
    // Convert the input to a string
    str = String(str);

    // If the target length is less than or equal to the string's length, return the original string
    if (str.length >= targetLength) {
      return str;
    }

    // Calculate the length of the padding needed
    var paddingLength = targetLength - str.length;

    // Repeat the padString enough times to cover the padding length
    var repeatedPadString = customRepeat(
      padString,
      Math.ceil(paddingLength / padString.length)
    );

    // Slice the repeated padString to the exact padding length needed and concatenate with the original string
    return repeatedPadString.slice(0, paddingLength) + str;
  }
  /**
   * @description Repeats the given string a specified number of times.
   * @param {string} str - The string to repeat.
   * @param {number} count - The number of times to repeat the string.
   * @returns {string} The repeated string.
   */
  function customRepeat(str, count) {
    // Convert the input to a string
    str = String(str);

    // If the count is 0 or less, return an empty string
    if (count <= 0) {
      return "";
    }

    // Initialize the result string
    var result = "";

    // Repeat the string by concatenating it to the result
    for (var i = 0; i < count; i++) {
      result += str;
    }

    return result;
  }

  function getDateToday() {
    var date = new Date();
    format.format({
      value: date,
      type: format.Type.DATE,
      timezone: format.Timezone.AUSTRALIA_SYDNEY
    });

    return date;
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

  return {
    onRequest: onRequest
  };
});
