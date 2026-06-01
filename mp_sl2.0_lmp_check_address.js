/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 *
 * Author:               Ankith Ravindran
 * Created on:           Mon May 18 2026
 * Modified on:          Mon May 18 2026 15:52:14
 * SuiteScript Version:  2.0
 * Description:          Check if the address entered is serviceable by any ZEE. Test upload
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

		var date = new Date();
		var date_now = format.parse({
			value: date,
			type: format.Type.DATE
		});
		var time_now = format.parse({
			value: date,
			type: format.Type.TIMEOFDAY
		});

		var invoicingMethod = [
			"Full Payment Customer",
			"Split Payment LPO & Customer",
			"Full Payment LPO"
		];

		if (context.request.method === "GET") {
			//{"zip":"2155","lpoid":"1927135","firstname":"Ankith","city":"Rouse Hill","address1":"90 Caddies Boulevard","companyName":"Test Company PQRS","script":"2168","deploy":"1","lastname":"Ravindran","compid":"1048144","phone":"0402712233","ns-at":"AAEJ7tMQ9qxU1ZofUpqPe2ZpEIw6G70q4kZeX4zsYESD6rZ87EQ","payment":"2","state":"NSW","custentity_firebase_uuid":"Vlhw2vOcyBVR7T8myTfzNQ2t38M2","email":"ankith88@gmail.com"}	Remove

			log.debug({
				title: "context.request.parameters",
				details: context.request.parameters
			});

			//Company Details
			var siteAddressStNoName = context.request.parameters.address1;
			var siteAddressLevel = context.request.parameters.address2;
			var siteAddressSuburb = context.request.parameters.city;
			var siteAddressZipCode = context.request.parameters.zip;
			var siteAddressState = context.request.parameters.state;
			var leadName = context.request.parameters.companyName;

			//Contact and User Firebase UUID
			var leadFirstName = context.request.parameters.firstname;
			var leadLastName = context.request.parameters.lastname;
			var leadPhone = context.request.parameters.phone;
			var leadEmail = context.request.parameters.email;
			var leadContactFirebaseUUID =
				context.request.parameters.custentity_firebase_uuid;

			if (
				!isNullorEmpty(siteAddressZipCode) &&
				!isNullorEmpty(siteAddressSuburb) &&
				!isNullorEmpty(siteAddressState)
			) {
				var zeeNetworkMatrixSearch = search.load({
					type: "partner",
					id: "customsearch_networkmtrx_zee_suburb_2"
				});

				zeeNetworkMatrixSearch.filters.push(
					search.createFilter({
						name: "entityid",
						join: null,
						operator: search.Operator.DOESNOTSTARTWITH,
						values: "old"
					})
				);

				zeeNetworkMatrixSearch.filters.push(
					search.createFilter({
						name: "custentity_ap_suburbs_json",
						join: null,
						operator: search.Operator.CONTAINS,
						values: siteAddressSuburb
					})
				);
				zeeNetworkMatrixSearch.filters.push(
					search.createFilter({
						name: "custentity_ap_suburbs_json",
						join: null,
						operator: search.Operator.CONTAINS,
						values: siteAddressState
					})
				);
				zeeNetworkMatrixSearch.filters.push(
					search.createFilter({
						name: "custentity_ap_suburbs_json",
						join: null,
						operator: search.Operator.CONTAINS,
						values: siteAddressZipCode
					})
				);

				var zeeCount = 0;
				var searchedZeeIDArray = [];
				zeeNetworkMatrixSearch
					.run()
					.each(function (zeeNetworkMatrixSearchResultSet) {
						searchedZeeIDArray.push(
							zeeNetworkMatrixSearchResultSet.getValue({
								name: "internalid"
							})
						);
						zeeCount++;

						return true;
					});

				log.debug({
					title: "searchedZeeIDArray",
					details: searchedZeeIDArray
				});
				log.debug({
					title: "zeeCount",
					details: zeeCount
				});

				//check if the zee is linked to the LPO Parent Customer
				var finalZeeIDArray = [];
				if (
					!isNullorEmpty(searchedZeeIDArray) &&
					searchedZeeIDArray.length > 0
				) {
					finalZeeIDArray = searchedZeeIDArray;
				}

				log.debug({
					title: "finalZeeIDArray",
					details: finalZeeIDArray
				});
				log.debug({
					title: "zeeCount",
					details: zeeCount
				});

				var zeeSuburbMappingJSON = [];
				if (zeeCount == 1) {
					var partnerRecord = record.load({
						type: record.Type.PARTNER,
						id: finalZeeIDArray[0]
					});

					var zeeJSONString = partnerRecord.getValue({
						fieldId: "custentity_zee_territory_json"
					});

					var zeeJSON = JSON.parse(zeeJSONString);
					zeeJSON.forEach(function (suburb) {
						zeeSuburbMappingJSON.push(suburb);
					});
				}

				//! Create a HOT Lead and assign to MailPlus Pty. Ltd. franchisee and send email to Hot Lead. Not creating company collection in Firestore.
				//CREATE PARENT LPO SUB CUSTOMER FOR ADHOC BOOKING
				var pushToProspectPlus = false;
				if (zeeCount >= 1) {
					var newLocalMilePlusCustomerRecord = record.create({
						type: record.Type.PROSPECT,
						isDynamic: true
					});

					newLocalMilePlusCustomerRecord.setValue({
						fieldId: "entitystatus",
						value: 82 //STATUS: PROSPECT - LOCALMILE OPPORTUNITY
					});
				} else {
					pushToProspectPlus = true;
					var newLocalMilePlusCustomerRecord = record.create({
						type: record.Type.LEAD,
						isDynamic: true
					});
					newLocalMilePlusCustomerRecord.setValue({
						fieldId: "entitystatus",
						value: 64 //SUSPECT - OUT OF TERRITORY
					});
				}

				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "companyname",
					value: leadName
				});

				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "email",
					value: leadEmail
				});
				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "custentity_email_service",
					value: leadEmail
				});
				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "custentity_email_sales",
					value: leadEmail
				});
				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "phone",
					value: leadPhone
				});
				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "altphone",
					value: leadPhone
				});
				if (zeeCount > 1 || zeeCount == 0) {
					newLocalMilePlusCustomerRecord.setValue({
						fieldId: "partner",
						value: 435 //Default the Partner to MailPlus
					});
				} else if (zeeCount == 1) {
					newLocalMilePlusCustomerRecord.setValue({
						fieldId: "partner",
						value: finalZeeIDArray[0] //Assign to the franchisee
					});
				}

				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "leadsource",
					value: 491777 //LocalMile.Plus
				});
				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "custentity_date_lead_entered",
					value: getDateStoreNS()
				});

				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "custentity_industry_category",
					value: 9
				});
				newLocalMilePlusCustomerRecord.setValue({
					fieldId: "custentity_localmile_sync",
					value: 1
				});

				//CREATE ADDRESS FOR LPO CUSTOMER FOR ADHOC JOB BOOKING SERVICES
				newLocalMilePlusCustomerRecord.selectNewLine({
					sublistId: "addressbook"
				});
				newLocalMilePlusCustomerRecord.setCurrentSublistValue({
					sublistId: "addressbook",
					fieldId: "label",
					value: "Site Address"
				});
				var addressSubrecord =
					newLocalMilePlusCustomerRecord.getCurrentSublistSubrecord({
						sublistId: "addressbook",
						fieldId: "addressbookaddress"
					});

				// Set values on the subrecord.
				// Set country field first when script uses dynamic mode
				addressSubrecord.setValue({
					fieldId: "country",
					value: "AU"
				});

				addressSubrecord.setValue({
					fieldId: "internalid",
					value: 1
				});

				addressSubrecord.setValue({
					fieldId: "city",
					value: siteAddressSuburb
				});

				addressSubrecord.setValue({
					fieldId: "state",
					value: siteAddressState
				});

				addressSubrecord.setValue({
					fieldId: "zip",
					value: siteAddressZipCode
				});

				addressSubrecord.setValue({
					fieldId: "addr1",
					value: siteAddressLevel
				});
				addressSubrecord.setValue({
					fieldId: "addr2",
					value: siteAddressStNoName
				});
				// addressSubrecord.setValue({
				//     fieldId: "custrecord_address_lat",
				//     value: nclAddressLat,
				// });
				// addressSubrecord.setValue({
				//     fieldId: "custrecord_address_lon",
				//     value: nclAddressLon,
				// });

				addressSubrecord.setValue({
					fieldId: "defaultshipping",
					value: true
				});
				addressSubrecord.setValue({
					fieldId: "defaultbilling",
					value: true
				});
				addressSubrecord.setValue({
					fieldId: "isresidential",
					value: false
				});
				addressSubrecord.setValue({
					fieldId: "addressee",
					value: leadName
				});

				newLocalMilePlusCustomerRecord.commitLine({
					sublistId: "addressbook"
				});

				newLocalMilePlusCustomerInternalId =
					newLocalMilePlusCustomerRecord.save();

				var newLocalMilePlusCustomerRecord = record.load({
					type: record.Type.CUSTOMER,
					id: newLocalMilePlusCustomerInternalId
				});

				var newLocalMilePlusCustomerEntityID =
					newLocalMilePlusCustomerRecord.getValue({
						fieldId: "entityid"
					});

				var contactRecord = record.create({
					type: record.Type.CONTACT
				});

				contactRecord.setValue({
					fieldId: "company",
					value: newLocalMilePlusCustomerInternalId
				});

				contactRecord.setValue({
					fieldId: "firstname",
					value: leadFirstName
				});
				contactRecord.setValue({
					fieldId: "lastname",
					value: leadLastName
				});

				contactRecord.setValue({
					fieldId: "entityid",
					value: leadFirstName + " " + leadLastName
				});

				contactRecord.setValue({
					fieldId: "email",
					value: leadEmail
				});
				contactRecord.setValue({
					fieldId: "phone",
					value: leadPhone
				});
				contactRecord.setValue({ fieldId: "contactrole", value: -10 });

				var primaryContactInternalID = contactRecord.save({
					ignoreMandatoryFields: true
				});

				log.audit({
					title: "LocalMile Plus Customer Created",
					details: newLocalMilePlusCustomerInternalId
				});

				//CREATE SALES RECORD
				var sales_record = record.create({
					type: "customrecord_sales"
				});
				sales_record.setValue({
					fieldId: "custrecord_sales_outcome",
					value: 20 //Assigned
				});

				sales_record.setValue({
					fieldId: "custrecord_sales_campaign",
					value: 99 //LocalMile.Plus
				});

				sales_record.setValue({
					fieldId: "custrecord_sales_customer",
					value: newLocalMilePlusCustomerInternalId
				});

				sales_record.setValue({
					fieldId: "custrecord_sales_assigned",
					value: 1822062 //Kerry
				});

				sales_record.setValue({
					fieldId: "custrecord_sales_lastcalldate",
					value: getDateStoreNS()
				});

				var newSalesRecordInternalId = sales_record.save();
				log.audit({
					title: "Sales Record Created",
					details: newSalesRecordInternalId
				});

				var leadSalesReppToAssignJSON = {
					customerId: parseInt(newLocalMilePlusCustomerInternalId),
					salesRecordId: parseInt(newSalesRecordInternalId)
				};

				//!Call Tim's script to assign the lead to a sales rep randomly.
				var leadSalesRepAssignedJSON = https.get({
					url:
						"https://1048144.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=2160&deploy=2&compid=1048144&ns-at=AAEJ7tMQ3VfSfXZtokK6wuyERCw4vIJ8YBmkKwc8nxv2kzikwgg&operation=assignCustomerToSalesRepsWithLeastLeads&requestParams=" +
						JSON.stringify(leadSalesReppToAssignJSON),
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json"
					}
				});

				leadSalesRepAssignedJSON = JSON.parse(leadSalesRepAssignedJSON.body);

				log.audit({
					title: "Lead Sales Rep Assigned JSON",
					details: leadSalesRepAssignedJSON
				});

				leadSalesRepAssigned = leadSalesRepAssignedJSON.internalid;
				var leadSalesRepAssignedName = leadSalesRepAssignedJSON.entityid;
				var leadSalesRepAssignedEmail = leadSalesRepAssignedJSON.email;

				log.audit({
					title: "Lead Sales Rep Assigned",
					details: leadSalesRepAssigned
				});

				//Update the Customer/Lead Record with the assigned sales rep
				var updateCustomerRecord = record.load({
					type: record.Type.LEAD,
					id: newLocalMilePlusCustomerInternalId
				});
				var entity_id = updateCustomerRecord.getValue({ fieldId: "entityid" });
				var customer_name = updateCustomerRecord.getValue({
					fieldId: "companyname"
				});
				var cust_id_link =
					baseURL +
					"/app/common/entity/custjob.nl?id=" +
					newLocalMilePlusCustomerInternalId;

				updateCustomerRecord.setValue({
					fieldId: "custentity_mp_toll_salesrep",
					value: parseInt(leadSalesRepAssigned)
				});
				newLocalMilePlusCustomerInternalId = updateCustomerRecord.save();

				//Update the Sales Record with the assigned sales rep
				var updateSalesRecord = record.load({
					type: "customrecord_sales",
					id: newSalesRecordInternalId
				});
				updateSalesRecord.setValue({
					fieldId: "custrecord_sales_assigned",
					value: parseInt(leadSalesRepAssigned)
				});
				lpoMainSubCustomerSalesRecordInternalId = updateSalesRecord.save();

				var apiHeaders = {};
				apiHeaders["Content-Type"] = "application/json";
				apiHeaders["x-api-key"] = "454e75f843954875ccff72537d7702ba1ab6f65c";

				var firebaseCheckLeadExistsURL =
					"https://prospectplus.com.au/api/leads/check?id=" +
					lpoMainSubCustomerSalesRecordInternalId;

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

				//If it does not exist, create the lead in Prospect+ (Firebase)
				if (!responseCheckLeadExistObj.exists) {
					//Load Customer Record
					var customer_record = record.load({
						type: record.Type.LEAD,
						id: newLocalMilePlusCustomerInternalId
					});

					var dateLeadEntered = customer_record.getValue({
						fieldId: "custentity_date_lead_entered"
					});
					var customerEntityId = customer_record.getValue({
						fieldId: "entityid"
					});
					var companyName = customer_record.getValue({
						fieldId: "companyname"
					});
					var franchisee = customer_record.getText({
						fieldId: "partner"
					});

					var customerPhone = customer_record.getValue({
						fieldId: "phone"
					});
					var customerEmail = customer_record.getValue({
						fieldId: "email"
					});
					var customerServiceEmail = customer_record.getValue({
						fieldId: "custentity_email_service"
					});
					var customerStatus = customer_record.getText({
						fieldId: "entitystatus"
					});
					var customerIndustryCategory = customer_record.getText({
						fieldId: "custentity_industry_category"
					});
					var customerSalesRep = customer_record.getText({
						fieldId: "salesrep"
					});
					var mpexInvoicingCycle = customer_record.getText({
						fieldId: "custentity_mpex_invoicing_cycle"
					});
					var customerSource = customer_record.getText({
						fieldId: "leadsource"
					});
					var industryCategory = customer_record.getText({
						fieldId: "custentity_industry_category"
					});
					var industrySubCategory = customer_record.getText({
						fieldId: "custentity_industry_sub_category"
					});
					var websiteUrl = customer_record.getValue({
						fieldId: "custentity_website_page_url"
					});

					//Load Site Address
					//NetSuite Search: Customer List - Site Addresses
					var siteAddressesSearch = search.load({
						id: "customsearch_cust_list_site_addresses_2",
						type: "customer"
					});

					siteAddressesSearch.filters.push(
						search.createFilter({
							name: "internalid",
							join: null,
							operator: search.Operator.ANYOF,
							values: newLocalMilePlusCustomerInternalId
						})
					);

					var shippingAddress1 = null;
					var shippingAddress2 = null;
					var shippingCity = null;
					var shippingStateProvince = null;
					var shippingZip = null;
					var shippingLat = null;
					var shippingLon = null;
					siteAddressesSearch
						.run()
						.each(function (siteAddressesSearchResultSet) {
							shippingAddress1 = siteAddressesSearchResultSet.getValue({
								name: "address1",
								join: "Address"
							});
							shippingAddress2 = siteAddressesSearchResultSet.getValue({
								name: "address2",
								join: "Address"
							});
							shippingCity = siteAddressesSearchResultSet.getValue({
								name: "city",
								join: "Address"
							});
							shippingStateProvince = siteAddressesSearchResultSet.getValue({
								name: "state",
								join: "Address"
							});
							shippingZip = siteAddressesSearchResultSet.getValue({
								name: "zipcode",
								join: "Address"
							});

							shippingLat = siteAddressesSearchResultSet.getValue({
								name: "custrecord_address_lat",
								join: "Address",
								summary: "GROUP"
							});
							shippingLon = siteAddressesSearchResultSet.getValue({
								name: "custrecord_address_lon",
								join: "Address",
								summary: "GROUP"
							});
						});

					var customerDetails = '{"fields": {';
					customerDetails +=
						'"internalid": {"stringValue": "' +
						newLocalMilePlusCustomerInternalId +
						'"},';
					customerDetails +=
						'"dateLeadEntered": {"stringValue": "' + dateLeadEntered + '"},';
					customerDetails +=
						'"customerEntityId": {"stringValue": "' + customerEntityId + '"},';
					customerDetails +=
						'"companyName": {"stringValue": "' + companyName + '"},';
					customerDetails +=
						'"franchisee": {"stringValue": "' + franchisee + '"},';

					customerDetails +=
						'"customerPhone": {"stringValue": "' + customerPhone + '"},';
					customerDetails +=
						'"customerEmail": {"stringValue": "' + customerEmail + '"},';
					customerDetails +=
						'"customerServiceEmail": {"stringValue": "' +
						customerServiceEmail +
						'"},';
					if (zeeCount == 0) {
						customerDetails += '"customerStatus": {"stringValue": "Lost"},';
					} else {
						customerDetails +=
							'"customerStatus": {"stringValue": "LocalMile Opportunity"},';
					}

					customerDetails +=
						'"customerCampaign": {"stringValue": "LocalMile.Plus"},';
					customerDetails +=
						'"customerIndustryCategory": {"stringValue": "' +
						customerIndustryCategory +
						'"},';
					customerDetails +=
						'"customerSalesRep": {"stringValue": "' +
						leadSalesRepAssignedName +
						'"},';
					customerDetails +=
						'"mpexInvoicingCycle": {"stringValue": "' +
						mpexInvoicingCycle +
						'"},';
					customerDetails +=
						'"customerSource": {"stringValue": "' + customerSource + '"},';

					customerDetails +=
						'"address1": {"stringValue": "' + shippingAddress1 + '"},';
					customerDetails +=
						'"street": {"stringValue": "' + shippingAddress2 + '"},';
					customerDetails += '"city": {"stringValue": "' + shippingCity + '"},';
					customerDetails +=
						'"state": {"stringValue": "' + shippingStateProvince + '"},';
					customerDetails += '"zip": {"stringValue": "' + shippingZip + '"},';
					customerDetails +=
						'"latitude": {"stringValue": "' + shippingLat + '"},';
					customerDetails +=
						'"longitude": {"stringValue": "' + shippingLon + '"},';

					customerDetails += '"dialerAssigned": {"stringValue": ""},';
					customerDetails +=
						'"salesRecordInternalId": {"stringValue": "' +
						newSalesRecordInternalId +
						'"},';
					customerDetails +=
						'"salesRepAssigned": {"stringValue": "' +
						leadSalesRepAssignedName +
						'"},';
					if (leadSalesRepAssignedName === "Luke Forbes") {
						customerDetails +=
							'"salesRepAssignedCalendlyLink": {"stringValue": "https://calendly.com/luke-forbes-mailplus/mailplus-intro-call-luke"},';
					} else if (leadSalesRepAssignedName === "Lee Russell") {
						customerDetails +=
							'"salesRepAssignedCalendlyLink": {"stringValue": "https://calendly.com/lee-russell-mailplus/mailplus-intro-call-lee"},';
					} else if (leadSalesRepAssignedName === "Kerina Helliwell") {
						customerDetails +=
							'"salesRepAssignedCalendlyLink": {"stringValue": "https://calendly.com/kerina-helliwell-mailplus/mailplus-intro-call-kerina"},';
					}
					customerDetails +=
						'"websiteUrl": {"stringValue": "' + websiteUrl + '"},';
					customerDetails +=
						'"industryCategory": {"stringValue": "' + industryCategory + '"},';
					customerDetails +=
						'"industrySubCategory": {"stringValue": "' +
						industrySubCategory +
						'"},';
					customerDetails +=
						'"netsuiteLeadStatus": {"stringValue": "' + customerStatus + '"}';
					customerDetails += "}}";

					log.debug({
						title: "customerDetails",
						details: customerDetails
					});

					var headerObj = {
						name: "Content-Type",
						value: "application/json"
					};

					var responseCreateLeadPP = https.post({
						url:
							"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads?documentId=" +
							newLocalMilePlusCustomerInternalId,
						body: customerDetails,
						headers: headerObj
					});

					log.debug({
						title: "responseCreateLeadPP",
						details: responseCreateLeadPP
					});

					var myresponseCreateLeadPP_body = responseCreateLeadPP.body;
					var myresponseCreateLeadPP_code = responseCreateLeadPP.code;

					log.debug({
						title: "myresponseCreateLeadPP_body",
						details: myresponseCreateLeadPP_body
					});

					log.debug({
						title: "myresponseCreateLeadPP_code",
						details: myresponseCreateLeadPP_code
					});

					if (myresponseCreateLeadPP_code == 200) {
						customer_record.setValue({
							fieldId: "custentity_lead_synced_to_firebase",
							value: 1
						});
						customer_record.save();
					}

					//Create Contact JSON
					if (!isNullorEmpty(primaryContactInternalID)) {
						var primaryContactFullName = leadFirstName + " " + leadLastName;
						var contactDetails = '{"fields": {';
						contactDetails += '"title": {"stringValue": ""},';
						contactDetails +=
							'"name": {"stringValue": "' + primaryContactFullName + '"},';
						contactDetails += '"email": {"stringValue": "' + leadEmail + '"},';
						contactDetails += '"phone": {"stringValue": "' + leadPhone + '"},';
						contactDetails += '"accessToLocalMile": {"stringValue": "yes"},';
						contactDetails += '"syncedWithNetSuite": {"booleanValue": true}';
						contactDetails += "}}";

						log.debug({
							title: "contactDetails",
							details: contactDetails
						});

						var headerObj = {
							name: "Content-Type",
							value: "application/json"
						};

						var responseSyncContacts = https.post({
							url:
								"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
								newLocalMilePlusCustomerInternalId +
								"/contacts?documentId=" +
								primaryContactInternalID,
							body: contactDetails,
							headers: headerObj
						});

						log.debug({
							title: "responseSyncContacts",
							details: responseSyncContacts
						});
					}
				}

				//If no franchises found, send email to Sales Team to follow up and create the LPO Sub Customer for Adhoc Booking
				if (zeeCount == 0) {
					//Send Email to Sales Team
					var subject =
						"LocalMile.Plus Generated HOT Lead - " +
						entity_id +
						" " +
						customer_name +
						"";
					body =
						"Hi, \n \nA HOT Lead has been entered into the System.\n Customer Name: " +
						entity_id +
						" " +
						customer_name +
						"\nLink: " +
						cust_id_link;

					email.send({
						author: 112209,
						body: body,
						recipients: [leadSalesRepAssigned],
						subject: subject,
						attachments: [],
						relatedRecords: { entityId: newLocalMilePlusCustomerInternalId }
					});
				}

				//If the 1 or more franchisses found, create the LPO Sub Customer for Adhoc Booking
				if (zeeCount >= 1) {
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
						value: newLocalMilePlusCustomerInternalId
					});
					customer_comm_reg.setValue({
						fieldId: "custrecord_salesrep",
						value: 1822062
					});
					if (zeeCount == 1) {
						customer_comm_reg.setValue({
							fieldId: "custrecord_franchisee",
							value: finalZeeIDArray[0]
						});
					} else if (zeeCount > 1) {
						customer_comm_reg.setValue({
							fieldId: "custrecord_franchisee",
							value: 435 //MailPlus Pty. Ltd.
						});
					}
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
						value: getStateId(siteAddressState)
					});
					customer_comm_reg.setValue({
						fieldId: "custrecord_sale_type",
						value: 1
					});
					customer_comm_reg.setValue({
						fieldId: "custrecord_commreg_sales_record",
						value: newSalesRecordInternalId
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
						value: newLocalMilePlusCustomerInternalId
					});
					if (zeeCount == 1) {
						serviceRecord.setValue({
							fieldId: "custrecord_service_franchisee",
							value: finalZeeIDArray[0]
						});
					} else if (zeeCount > 1) {
						serviceRecord.setValue({
							fieldId: "custrecord_service_franchisee",
							value: 435 //MailPlus Pty. Ltd.
						});
					}
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
					if (zeeCount == 1) {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_old_zee",
							value: finalZeeIDArray[0]
						});
					} else if (zeeCount > 1) {
						new_service_change_record.setValue({
							fieldId: "custrecord_servicechg_old_zee",
							value: 435 //MailPlus Pty. Ltd.
						});
					}

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

					var pmpoServiceChangeRecordInternalId =
						new_service_change_record.save();

					log.audit({
						title: "PMPO Service Change Record Created",
						details: pmpoServiceChangeRecordInternalId
					});

					//Create Lead Firebase Record in LocalMile.Plus Firestore
					var customerDetails = '{"fields": {';

					customerDetails +=
						'"companyId": {"stringValue": "' +
						newLocalMilePlusCustomerInternalId +
						'"},';
					customerDetails +=
						'"customerEntityId": {"stringValue": "' +
						newLocalMilePlusCustomerEntityID +
						'"},';

					customerDetails +=
						'"companyName": {"stringValue": "' + leadName + '"},';
					if (zeeCount == 1) {
						customerDetails +=
							'"franchisee": {"stringValue": "' + finalZeeIDArray + '"},';
					} else if (zeeCount > 1) {
						customerDetails += '"franchisee": {"stringValue": "435"},';
					}
					customerDetails +=
						'"franchiseeTerritoryJSON": {"arrayValue": { "values": [';
					zeeSuburbMappingJSON.forEach(function (suburb) {
						var stringValue =
							suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
						customerDetails += '{"stringValue": "' + stringValue + '"},';
					});
					customerDetails += "]}},";

					//Contact Fields
					customerDetails +=
						'"customerPhone": {"stringValue": "' + leadPhone + '"},';
					customerDetails +=
						'"customerEmail": {"stringValue": "' + leadEmail + '"},';
					customerDetails +=
						'"customerServiceEmail": {"stringValue": "' + leadEmail + '"},';

					//Address Fields
					if (!isNullorEmpty(siteAddressLevel)) {
						customerDetails +=
							'"address1": {"stringValue": "' + siteAddressLevel + '"},';
					} else {
						customerDetails += '"address1": {"stringValue": ""},';
					}

					customerDetails +=
						'"street": {"stringValue": "' + siteAddressStNoName + '"},';
					customerDetails +=
						'"city": {"stringValue": "' + siteAddressSuburb + '"},';
					customerDetails +=
						'"state": {"stringValue": "' + siteAddressState + '"},';
					customerDetails +=
						'"zip": {"stringValue": "' + siteAddressZipCode + '"},';

					//Service Rates
					customerDetails +=
						'"servicePMPOInternalID": {"stringValue": "' +
						localmilePMPOInternalID +
						'"},';
					customerDetails +=
						'"servicePMPORate": {"stringValue": "' + localmilePMPORate + '"},';
					customerDetails += '"extraWeightCharges": {"stringValue": "3.50"},';
					customerDetails += '"trial_credits_balance": {"integerValue": 5},';

					customerDetails += "}}";

					log.debug({
						title: "customerDetails",
						details: customerDetails
					});

					var url =
						"https://firestore.googleapis.com/v1/projects/localmile-plus/databases/(default)/documents/companies?documentId=" +
						newLocalMilePlusCustomerInternalId.toString();

					var headerObj = {
						name: "Content-Type",
						value: "application/json"
					};

					var response = https.post({
						url: url,
						body: customerDetails,
						headers: headerObj
					});

					log.debug({
						title: "response",
						details: response
					});

					//Update User Collection with the Lead ID

					var customerDetails = '{"fields": {';
					customerDetails +=
						'"companyId": {"stringValue": "' +
						newLocalMilePlusCustomerInternalId.toString() +
						'"}';
					customerDetails +=
						'"customer_id": {"stringValue": "' +
						newLocalMilePlusCustomerInternalId.toString() +
						'"}';
					customerDetails += '"role": {"stringValue": "customer"}';
					customerDetails += "}}";

					log.debug({
						title: "customerDetails",
						details: customerDetails
					});

					var firebaseUpdateURL =
						"https://firestore.googleapis.com/v1/projects/localmile-plus/databases/(default)/documents/users/" +
						leadContactFirebaseUUID +
						"?updateMask.fieldPaths=companyId&updateMask.fieldPaths=customer_id&updateMask.fieldPaths=role";

					log.debug({
						title: "firebaseUpdateURL",
						details: firebaseUpdateURL
					});

					var apiHeaders = {};
					apiHeaders["Content-Type"] = "application/json";
					apiHeaders["Accept"] = "*/*";
					apiHeaders["X-HTTP-Method-Override"] = "PATCH";

					var response = https.request({
						method: https.Method.POST,
						url: firebaseUpdateURL,
						body: customerDetails,
						headers: apiHeaders
					});

					log.debug({
						title: "response",
						details: response
					});

					if (zeeCount > 1) {
						//Send Email to MailPlus IT Team to update Franchisee in NtSuite and then sync Franchisee to LocalMile.Plus
						email.send({
							author: 112209, //MailPlus Team
							body:
								"Hi Team, \n \nA new LocalMile.Plus lead has been created with multiple franchisees in the serviceable area. Please check the lead details and update the franchisee in NetSuite. Once updated, please resync the franchisee details to LocalMile.Plus.\n Customer Name: " +
								entity_id +
								" " +
								customer_name +
								"\nLink: " +
								cust_id_link,
							recipients: "mailplusit@mailplus.com.au",
							subject:
								"LocalMile.Plus Generated Lead - " +
								entity_id +
								" " +
								customer_name +
								" - Franchisee Needs to be Assigned",
							relatedRecords: { entityId: newLocalMilePlusCustomerInternalId }
						});
					}

					var returnObj = {
						isServiceable: true,
						leadID: newLocalMilePlusCustomerInternalId.toString(),
						message: "",
						result: "Address is serviceable"
					};
				} else {
					var returnObj = {
						isServiceable: false,
						message: "",
						result: "Address is not serviceable"
					};
				}
			} else {
				var returnObj = {
					isServiceable: false,
					message: "",
					result: "Address Details Not Provided"
				};
			}

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

	return {
		onRequest: onRequest
	};
});
