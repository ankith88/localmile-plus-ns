/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Tue Apr 21 2026
 * Modified on:          Tue Apr 21 2026 12:21:29
 * SuiteScript Version:  2.0
 * Description:          Suitelet used to send out the request to the franchisee owner of a new job request from the LPO.
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
		var year = date.getFullYear();
		var month = pad(date.getMonth() + 1);
		var day = pad(date.getDate());
		var todayDate = year + "-" + month + "-" + day;
		var date_now = format.parse({
			value: date,
			type: format.Type.DATE
		});
		var time_now = format.parse({
			value: date,
			type: format.Type.TIMEOFDAY
		});
		var year = new Date().getFullYear();
		var zeeName = null;
		var zeeEmail = null;
		var zeePhone = null;

		if (context.request.method === "GET") {
			log.debug({
				title: "context.request.parameters",
				details: context.request.parameters
			});

			//{"ns-at":"AAEJ7tMQGy_V6q4A1r9Jg30iQSZhzKVAi6M4UjCI17mvD37SfLM","customer_id":"2003503","compid":"1048144","request_id":"yiJadVjfkyHMdFyPnkAf","script":"2646","deploy":"1"}

			var jobRequestId = context.request.parameters.request_id;
			var lpoInternalId = context.request.parameters.lpo_id;
			var customerInternalId = context.request.parameters.customer_id;

			var customerRecord = record.load({
				type: "customer",
				id: customerInternalId
			});
			var business_name = customerRecord.getValue({
				fieldId: "companyname"
			});
			var partnerID = customerRecord.getValue({
				fieldId: "partner"
			});

			var customerPartnerRecord = record.load({
				type: "partner",
				id: partnerID
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

			var jobRequestPageURL =
				"https://localmile.plus/request/" +
				context.request.parameters.request_id;

			var emailSubject = "New Job Request for " + business_name;
			// var emailBody =
			// 	"You have received a new job request for " +
			// 	business_name +
			// 	". Please click the link below to view the details of the request and accept or reject it. \n\n" +
			// 	jobRequestPageURL;

			var emailBody =
				'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MailPlus - Authenticate Your Access</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>body,html{margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background-color:#f4f7f8;}.email-container{font-family:"Inter",system-ui,-apple-system,sans-serif;max-width:600px;margin:40px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(9,92,123,0.08);border:1px solid #e1e8ed;}.content{padding:45px 35px 35px 35px;color:#333333;line-height:1.6;}.greeting{font-size:22px;margin-bottom:12px;color:#095c7b;font-weight:700;letter-spacing:-0.5px;}.sub-text{font-size:15px;color:#556068;margin-bottom:25px;}.action-box{background-color:#f8fafb;border-radius:12px;padding:30px 20px;margin:25px 0;border-left:4px solid #EAF044;text-align:center;}.action-box-title{font-weight:600;color:#095c7b;margin-bottom:15px;font-size:13px;text-transform:uppercase;letter-spacing:1px;}.security-code{font-size:38px;font-weight:800;color:#095c7b;letter-spacing:6px;margin:10px 0;}.security-hint{font-size:13px;color:#718096;font-weight:500;margin-top:10px;}.button-container{text-align:center;margin:35px 0 20px 0;}.btn-primary{background-color:#EAF044;color:#095c7b !important;padding:16px 36px;text-decoration:none;font-weight:700;font-size:13px;border-radius:8px;display:inline-block;transition:all 0.2s ease-in-out;box-shadow:0 4px 14px rgba(234,240,68,0.4);text-transform:uppercase;letter-spacing:1px;}.btn-primary:hover{background-color:#dbe236;box-shadow:0 6px 18px rgba(234,240,68,0.5);transform:translateY(-1px);}.raw-link-text{font-size:13px;color:#718096;word-break:break-all;margin-top:25px;text-align:center;line-height:1.5;}.raw-link-text a{color:#095c7b;text-decoration:underline;}.branding-banner{background-color:#095c7b;padding:25px 20px;text-align:center;}.brand-logo{display:inline-block;vertical-align:middle;max-height:42px;width:auto;border:0;}.footer{background-color:#f8fafb;padding:30px 20px;text-align:center;font-size:12px;color:#718096;border-top:1px solid #edf2f7;}.footer p{margin:6px 0;line-height:1.5;}@media screen and (max-width:600px){.email-container{margin:10px auto;border-radius:8px;}.content{padding:35px 20px;}.greeting{font-size:20px;}.btn-primary{width:100%;box-sizing:border-box;padding:15px 20px;}.brand-logo{max-height:36px;}}</style></head>';

			emailBody +=
				'<body><div class="email-container"><div class="content"><div class="greeting">New Job Request Received</div><div class="sub-text"> Hi ' +
				mainContactName +
				", </br></br>A new job request has been submitted for <strong>" +
				business_name +
				'</strong> and is currently awaiting your review.</div><div class="action-box"><div class="action-box-title">Action Required</div><div class="security-code"></div><div class="security-hint"><p>Please follow the link below to view the full job details. You will need to:</p><ul style="padding-left:20px;text-align:left !important;"><li><strong>Accept</strong> the request to add it to your manifest.</li><li><strong>Decline</strong> the job if it cannot be fulfilled.</li><li><strong>Propose a new time</strong> if the requested service time is unavailable</li></ul><p>You can also use the integrated portal to <strong>chat directly with the LPO</strong> regarding any specific logistics or instructions for this request.</p></div></div>';

			emailBody +=
				'<div class="button-container"><a href="' +
				jobRequestPageURL +
				'" target="_blank" class="btn-primary">View Request & Chat</a></div>';

			emailBody +=
				'<div class="branding-banner"><img src="https://lh3.googleusercontent.com/d/1hhLMkl8NmyhkhDT9jDg9AYIhbIRsjQQD" alt="MailPlus Logo" class="brand-logo"></div>';

			emailBody +=
				'<div class="footer"><p><strong>MailPlus</strong> | Business logistics, made simple.</p><p>Powered by MailPlus Australia</p><p style="margin-top:15px;font-size:11px;color:#a0aec0;"> &copy; ' +
				year +
				" MailPlus. All rights reserved. <br> You are receiving this system communication as part of your registered account activation flow. </p></div></div>";

			emailBody += "</body></html>";

			// Send email to franchisee owner
			// email.send({
			// 	author: 112209,
			// 	recipients: partnerEmail,
			// 	subject: emailSubject,
			// 	body: emailBody,
			// 	bcc: ["dispatcher@mailplus.com.au", "customerservice@mailplus.com.au"],
			// 	relatedRecords: { entityId: customerInternalId }
			// });

			//Send Email using bookings@lpo.plus domain using the LPO.PLUS Application API.
			/**
			 * {
				"from": "sales@mailplus.com.au",
				"to": "client@example.com",
				"cc": "manager@example.com",
				"subject": "NetSuite Update",
				"html": "<p>Your order has been processed.</p>",
				"metadata": {
					"customerId": "lead_document_id_here",
					"jobId": "12345"
				}
				}
			 */
			var sendOutEmailJSON = {
				from: "localmile@mailplus.com.au",
				to: partnerEmail,
				cc: "",
				subject: emailSubject,
				html: emailBody,
				metadata: {
					customerId: customerInternalId,
					jobId: jobRequestId
				}
			};
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

			log.audit({
				title: "Email sent to franchisee owner at " + partnerEmail,
				details:
					"Response Body: " +
					myresponse_body +
					", Response Code: " +
					myresponse_code
			});

			//Send SMS
			var smsText =
				"Hi " +
				mainContactName +
				", A new job request has been submitted for " +
				business_name +
				" and is currently awaiting your review. Please click the link to view details and accept or reject: " +
				jobRequestPageURL;

			var sendOutSMSJSON = {
				to: partnerPhone,
				message: smsText,
				leadId: customerInternalId // Optional: to log the activity under this lead
			};

			var firebaseSendSMSURL =
				"https://prospectplus.com.au/api/campaigns/send-custom-sms";

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";

			var responseSendSMS = https.request({
				method: https.Method.POST,
				url: firebaseSendSMSURL,
				body: JSON.stringify(sendOutSMSJSON),
				headers: apiHeaders
			});

			var myresponseSendSMS_body = responseSendSMS.body;
			var myresponseSendSMS_code = responseSendSMS.code;

			log.audit({
				title: "SMS sent to franchisee owner at " + partnerPhone,
				details:
					"Response Body: " +
					myresponseSendSMS_body +
					", Response Code: " +
					myresponseSendSMS_code
			});

			var returnObj = {
				success: true,
				message: "Email & SMS sent to the franchisee owner."
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
