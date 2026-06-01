/** 
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 
 * Author:               Ankith Ravindran
 * Created on:           Wed Jan 21 2026
 * Modified on:          Wed Jan 21 2026 11:46:13
 * SuiteScript Version:  2.0 
 * Description:          Suitelet API to resync Lead to ProspectPlus Firebase. 
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

	function onRequest(context) {
		if (context.request.method === "GET") {
			var todayDate = new Date();
			var yesterdayDate = new Date(todayDate);

			log.audit({
				title: "todayDate",
				details: todayDate
			});

			// dialers.forEach(function (d) { dialerCounts[d] = 0; });

			//GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
			var tokenBody =
				'{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";

			var responseAccessToken = https.request({
				method: https.Method.POST,
				url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDklo95QYbj4PGZeKAqRBBzCfFKc9CFoXs",
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

			log.audit({
				title: "context.request.parameters",
				details: context.request.parameters
			});

			var internalid = context.request.parameters.customerInternalId;

			//Load Parent LPO Record
			var customerRecord = record.load({
				type: record.Type.LEAD,
				id: internalid
			});

			//Get Customer Details
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

			customerRecord.setValue({
				fieldId: "entitystatus",
				value: 82 //STATUS: PROSPECT - LOCALMILE OPPORTUNITY
			});
			customerRecord.save();

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

			//CREATE COMM REG
			var customer_comm_reg = record.create({
				type: "customrecord_commencement_register",
				isDynamic: true
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_date_entry",
				value: getDateStoreNS()
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_comm_date",
				value: getDateStoreNS()
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_comm_date_signup",
				value: getDateStoreNS()
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_customer",
				value: internalid
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_salesrep",
				value: salesRecordLastAssigned
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_franchisee",
				value: franchiseeInternalID
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_wkly_svcs",
				value: "5"
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_in_out",
				value: 2
			}); // Inbound
			customer_comm_reg.setValue({
				fieldId: "custrecord_state",
				value: getStateId(shippingStateProvince)
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_sale_type",
				value: 1
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_commreg_sales_record",
				value: salesRecordInternalId
			});
			customer_comm_reg.setValue({
				fieldId: "custrecord_trial_status",
				value: 2
			});
			newCommRegInternalId = customer_comm_reg.save();
			log.audit({
				title: "Comm Reg Record created",
				details: newCommRegInternalId
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
					values: parseInt(internalid)
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
				lpoContactFName = serviceContactResult[0].getValue({
					name: "firstname"
				});
				lpoContactLName = serviceContactResult[0].getValue({
					name: "lastname"
				});
				lpoContactEmail = serviceContactResult[0].getValue({
					name: "email"
				});
				lpoContactPhone = serviceContactResult[0].getValue({
					name: "phone"
				});
			}

			//PMPO SERVICE
			var serviceRecord = record.create({
				type: "customrecord_service",
				isDynamic: true
			});
			serviceRecord.setValue({ fieldId: "name", value: "PMPO" });
			//Adhoc rate set at $15 for PMPO, as per discussion with Ops Team on 19/05/2026. This is to ensure that the service change record gets created with the correct rate and frequency for the PMPO service when the services are added to the customer record.
			serviceRecord.setValue({
				fieldId: "custrecord_service_price",
				value: 15
			});
			serviceRecord.setValue({
				fieldId: "custrecord_service",
				value: 4
			});
			serviceRecord.setValue({
				fieldId: "custrecord_service_comm_reg",
				value: newCommRegInternalId
			});
			serviceRecord.setValue({
				fieldId: "custrecord_service_customer",
				value: internalid
			});

			serviceRecord.setValue({
				fieldId: "custrecord_service_franchisee",
				value: franchiseeInternalID
			});

			serviceRecord.setValue({
				fieldId: "custrecord_service_day_adhoc",
				value: true
			});
			serviceRecord.setValue({
				fieldId: "custrecord_service_day_freq_cycle",
				value: 4
			});
			var pmpoServiceInternalId = serviceRecord.save();
			log.audit({
				title: "PMPO Service Record Created",
				details: pmpoServiceInternalId
			});

			localmilePMPOInternalID = pmpoServiceInternalId;
			localmilePMPORate = 15;

			//CREATE SERVICE CHANGE RECORD FOR PMPO SERVICE
			var new_service_change_record = record.create({
				type: "customrecord_servicechg",
				isDynamic: true
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_date_effective",
				value: getDateStoreNS()
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_service",
				value: pmpoServiceInternalId
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_status",
				value: 4
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_old_zee",
				value: franchiseeInternalID
			});

			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_new_price",
				value: 15
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_new_freq",
				value: 6
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_comm_reg",
				value: newCommRegInternalId
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_created",
				value: 1822062
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_servicechg_type",
				value: "New Customer"
			});
			new_service_change_record.setValue({
				fieldId: "custrecord_default_servicechg_record",
				value: 1
			});

			var pmpoServiceChangeRecordInternalId = new_service_change_record.save();

			log.audit({
				title: "PMPO Service Change Record Created",
				details: pmpoServiceChangeRecordInternalId
			});

			var customerDetails = '{"fields": {';
			customerDetails += '"companyId": {"stringValue": "' + internalid + '"},';
			customerDetails +=
				'"dateLeadEntered": {"stringValue": "' + dateLeadEntered + '"},';
			customerDetails +=
				'"customerEntityId": {"stringValue": "' + customerEntityId + '"},';
			customerDetails +=
				'"companyName": {"stringValue": "' + companyName + '"},';
			customerDetails += '"franchisee": {"stringValue": "' + franchisee + '"},';

			customerDetails +=
				'"franchiseeTerritoryJSON": {"arrayValue": { "values": [';
			zeeSuburbMappingJSON.forEach(function (suburb) {
				var stringValue =
					suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
				customerDetails += '{"stringValue": "' + stringValue + '"},';
			});
			customerDetails += "]}},";

			customerDetails +=
				'"customerPhone": {"stringValue": "' + customerPhone + '"},';
			customerDetails +=
				'"customerEmail": {"stringValue": "' + customerEmail + '"},';
			customerDetails +=
				'"customerServiceEmail": {"stringValue": "' +
				customerServiceEmail +
				'"},';

			customerDetails +=
				'"address1": {"stringValue": "' + shippingAddress1 + '"},';
			customerDetails +=
				'"street": {"stringValue": "' + shippingAddress2 + '"},';
			customerDetails += '"city": {"stringValue": "' + shippingCity + '"},';
			customerDetails +=
				'"state": {"stringValue": "' + shippingStateProvince + '"},';
			customerDetails += '"zip": {"stringValue": "' + shippingZip + '"},';

			//Service Rates
			customerDetails +=
				'"servicePMPOInternalID": {"stringValue": "' +
				localmilePMPOInternalID +
				'"},';
			customerDetails +=
				'"servicePMPORate": {"stringValue": "' + localmilePMPORate + '"},';
			customerDetails += '"extraWeightCharges": {"stringValue": "3.50"},';
			customerDetails += '"trial_credits_balance": {"int64": 5},';

			customerDetails += "}}";

			log.debug({
				title: "customerDetails",
				details: customerDetails
			});

			//TODO: Create account in LocalMile.Plus Application

			var firebaseCreateURL =
				"https://localmile-plus.web.app/api/v1/accounts/provision";

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";
			apiHeaders["x-api-key"] =
				"f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

			var response = https.request({
				method: https.Method.POST,
				url: firebaseCreateURL,
				body: customerDetails,
				headers: apiHeaders
			});

			// var myresponse_body = response.body;
			// var myresponse_code = response.code;

			_sendJSResponse(context.request, context.response, returnObj);
		} else {
		}
	}

	return {
		onRequest: onRequest
	};

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

	function getSalesRepWithMinCount(salesReps, salesRepCounts) {
		// Find the minimum count among all sales reps
		var minCount = null;
		for (var i = 0; i < salesReps.length; i++) {
			var count = salesRepCounts[salesReps[i]];
			if (minCount === null || count < minCount) {
				minCount = count;
			}
		}
		// Collect all sales reps with the minimum count
		var eligibleSalesReps = [];
		for (var i = 0; i < salesReps.length; i++) {
			if (salesRepCounts[salesReps[i]] === minCount) {
				eligibleSalesReps.push(salesReps[i]);
			}
		}
		return eligibleSalesReps;
	}

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

	function removeDuplicates(arr) {
		var unique = [];
		for (var i = 0; i < arr.length; i++) {
			if (unique.indexOf(arr[i]) === -1) {
				unique.push(arr[i]);
			}
		}
		return unique;
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

	function removeDuplicatesBySuburbStatePostcode(lpoSuburbMappingJSON) {
		var seen = {};
		var result = [];
		for (var i = 0; i < lpoSuburbMappingJSON.length; i++) {
			var item = lpoSuburbMappingJSON[i];
			var key = item.suburbs + "|" + item.state + "|" + item.post_code;
			if (!seen[key]) {
				seen[key] = true;
				result.push(item);
			}
		}
		return result;
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
