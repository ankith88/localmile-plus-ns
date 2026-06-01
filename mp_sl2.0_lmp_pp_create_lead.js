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

			//GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
			var tokenBody =
				'{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";

			var responseAccessToken = https.request({
				method: https.Method.POST,
				url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyBjmbHw0qCZeyZLnTC3k7mpd4-wYscNXBc",
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

			//Get LEAD INTERNAL ID FROM REQUEST
			//{"serviceType":"Adhoc","compid":"1048144","rate":"15","ns-at":"AAEJ7tMQnTpHlatbGqddTAKUm9-fzPWGQ8LslucF9a1gs3nU_5E","script":"2645","deploy":"1","leadId":"1938360"}
			/**
			 * contactFirstName, contactLastName, contactEmail, contactPhone
			 */
			var internalid = context.request.parameters.leadId;
			var serviceRate = context.request.parameters.rate;
			var contactFirstName = context.request.parameters.contactFirstName;
			var contactLastName = context.request.parameters.contactLastName;
			var contactEmail = context.request.parameters.contactEmail;
			var contactPhone = context.request.parameters.contactPhone;

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

			var firebaseLeadURL =
				"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
				internalid;

			var apiHeaders = {};
			apiHeaders["Content-Type"] = "application/json";
			apiHeaders["Accept"] = "*/*";
			apiHeaders["Authorization"] = "Bearer " + idToken;

			var responseProspectPlusLeadDocument = https.request({
				method: https.Method.GET,
				url: firebaseLeadURL,
				headers: apiHeaders
			});

			var dbProspectPlusBody = responseProspectPlusLeadDocument.body;

			log.audit({
				title: "Lead ProspectPlus Firebase Data",
				details: dbProspectPlusBody
			});

			var responseObj = JSON.parse(dbProspectPlusBody);

			//Check if fields exist
			if (!isNullorEmpty(responseObj.fields)) {
				//READ AND SYNC DISCOVERY QUESTIONS
				if (!isNullorEmpty(responseObj.fields.discoveryData)) {
					var discoveryQuestionsMap = responseObj.fields.discoveryData.mapValue;

					log.audit({
						title: "discoveryQuestionsMap",
						details: discoveryQuestionsMap
					});

					if (!isNullorEmpty(discoveryQuestionsMap.fields.packageType)) {
						var discoveryQsPackageTypeArray =
							discoveryQuestionsMap.fields.packageType.arrayValue.values;
						if (!isNullorEmpty(discoveryQsPackageTypeArray)) {
							var packageType = "";
							for (var p = 0; p < discoveryQsPackageTypeArray.length; p++) {
								if (p == 0) {
									packageType += discoveryQsPackageTypeArray[p].stringValue;
								} else {
									packageType +=
										"; " + discoveryQsPackageTypeArray[p].stringValue;
								}
							}
						}
					} else {
						var packageType = "";
					}

					if (!isNullorEmpty(discoveryQuestionsMap.fields.score)) {
						var discoveryQsScore =
							discoveryQuestionsMap.fields.score.integerValue;
					} else {
						var discoveryQsScore = 0;
					}

					if (!isNullorEmpty(discoveryQuestionsMap.fields.logisticsSetup)) {
						var discoveryQsLogisticsSetup =
							discoveryQuestionsMap.fields.logisticsSetup.stringValue;
					} else {
						var discoveryQsLogisticsSetup = "";
					}

					if (!isNullorEmpty(discoveryQuestionsMap.fields.routingTag)) {
						var discoveryQsRoutingTag =
							discoveryQuestionsMap.fields.routingTag.stringValue;
					} else {
						var discoveryQsRoutingTag = "";
					}

					if (!isNullorEmpty(discoveryQuestionsMap.fields.sameDayCourier)) {
						var discoveryQsSameDayCourier =
							discoveryQuestionsMap.fields.sameDayCourier.stringValue;
					} else {
						var discoveryQsSameDayCourier = "";
					}
					if (!isNullorEmpty(discoveryQuestionsMap.fields.eCommerceTech)) {
						var discoveryQsOtherECommerceTechArray =
							discoveryQuestionsMap.fields.eCommerceTech.arrayValue.values;
						if (!isNullorEmpty(discoveryQsOtherECommerceTechArray)) {
							var otherECommerceTech = "";
							for (
								var o = 0;
								o < discoveryQsOtherECommerceTechArray.length;
								o++
							) {
								if (o == 0) {
									otherECommerceTech +=
										discoveryQsOtherECommerceTechArray[o].stringValue;
								} else {
									otherECommerceTech +=
										"; " + discoveryQsOtherECommerceTechArray[o].stringValue;
								}
							}
						} else {
							var otherECommerceTech = "";
						}
					} else {
						var otherECommerceTech = "";
					}
					if (!isNullorEmpty(discoveryQuestionsMap.fields.scoringReason)) {
						var discoveryQsScoringReason =
							discoveryQuestionsMap.fields.scoringReason.stringValue;
					} else {
						var discoveryQsScoringReason = "";
					}

					if (
						!isNullorEmpty(discoveryQuestionsMap.fields.postOfficeRelationship)
					) {
						var discoveryQsPostOfficeRelationship =
							discoveryQuestionsMap.fields.postOfficeRelationship.stringValue;
					} else {
						var discoveryQsPostOfficeRelationship = "";
					}
					if (!isNullorEmpty(discoveryQuestionsMap.fields.expressVsStandard)) {
						var discoveryQsExpressVsStandard =
							discoveryQuestionsMap.fields.expressVsStandard.stringValue;
					} else {
						var discoveryQsExpressVsStandard = "";
					}
					if (!isNullorEmpty(discoveryQuestionsMap.fields.shippingVolume)) {
						var discoveryQsShippingVolume =
							discoveryQuestionsMap.fields.shippingVolume.stringValue;
					} else {
						var discoveryQsShippingVolume = "";
					}
					if (!isNullorEmpty(discoveryQuestionsMap.fields.painPoints)) {
						var discoveryQsPainPoints =
							discoveryQuestionsMap.fields.painPoints.stringValue;
					} else {
						var discoveryQsPainPoints = "";
					}
					if (!isNullorEmpty(discoveryQuestionsMap.fields.decisionMaker)) {
						var discoveryQsDecisionMaker =
							discoveryQuestionsMap.fields.decisionMaker.stringValue;
					} else {
						var discoveryQsDecisionMaker = "";
					}
					if (!isNullorEmpty(discoveryQuestionsMap.fields.currentProvider)) {
						var discoveryQsCurrentProviderArray =
							discoveryQuestionsMap.fields.currentProvider.arrayValue.values;
						if (!isNullorEmpty(discoveryQsCurrentProviderArray)) {
							var currentProvider = "";
							for (var c = 0; c < discoveryQsCurrentProviderArray.length; c++) {
								if (c == 0) {
									currentProvider +=
										discoveryQsCurrentProviderArray[c].stringValue;
								} else {
									currentProvider +=
										"; " + discoveryQsCurrentProviderArray[c].stringValue;
								}
							}
						}
					} else {
						var currentProvider = "";
					}

					customerRecord.setValue({
						fieldId: "custentity_prospectplus_po_relationship",
						value: discoveryQsPostOfficeRelationship
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_logistic_setup",
						value: discoveryQsLogisticsSetup
					});
					// customerRecord.setValue({
					//     fieldId: 'custentity_prospectplus_service_payment',
					//     value: discoveryQs
					// });
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_shipping_volume",
						value: discoveryQsShippingVolume
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_exp_vs_std",
						value: discoveryQsExpressVsStandard
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_package_type",
						value: packageType
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_current_provider",
						value: currentProvider
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_ecomm_tech",
						value: otherECommerceTech
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_same_day_courier",
						value: discoveryQsSameDayCourier
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_decision_maker",
						value: discoveryQsDecisionMaker
					});
					customerRecord.setValue({
						fieldId: "custentity_pain_points",
						value: discoveryQsPainPoints
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_score",
						value: discoveryQsScore
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_scoring_reason",
						value: discoveryQsScoringReason
					});
					customerRecord.setValue({
						fieldId: "custentity_prospectplus_routing_tag",
						value: discoveryQsRoutingTag
					});
				}

				var capturedBy = "";
				var visitNoteOutcomeType = "";
				var discoverySignals = "";

				var personSpokenWith = "";
				var personSpokenWithTitle = "";
				var personSpokenWithEmail = "";
				var personSpokenWithPhone = "";

				var decisionMakerName = "";
				var decisionMakerTitle = "";
				var decisionMakerEmail = "";
				var decisionMakerPhone = "";
				//VISIT NOTE ID AND GET DETAILS OF VISIT NOTE TO SYNC IN CUSTOMER RECORD
				if (!isNullorEmpty(responseObj.fields.visitNoteID)) {
					var visitNoteID = responseObj.fields.visitNoteID.stringValue;

					log.audit({
						title: "Visit Note ID",
						details: visitNoteID
					});

					var firebaseVisitNoteURL =
						"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/visitnotes/" +
						visitNoteID;

					var apiHeaders = {};
					apiHeaders["Content-Type"] = "application/json";
					apiHeaders["Accept"] = "*/*";
					apiHeaders["Authorization"] = "Bearer " + idToken;

					var responseVisitNoteDocument = https.request({
						method: https.Method.GET,
						url: firebaseVisitNoteURL,
						headers: apiHeaders
					});

					var dbVisitNoteBody = responseVisitNoteDocument.body;

					log.audit({
						title: "Visit Note Firebase Data",
						details: dbVisitNoteBody
					});

					var responseVisitNoteObj = JSON.parse(dbVisitNoteBody);

					//{"outcome":{"mapValue":{"fields":{"type":{"stringValue":"Appointment Qualified"},"details":{"mapValue":{"fields":{"salesRep":{"stringValue":"Lee Russell"}}}}}}},"websiteUrl":{"stringValue":"http://www.stratarepublic.com.au/"},"createdAt":{"stringValue":"2026-02-27T01:37:32.814Z"},"scheduledTime":{"stringValue":"11am"},"googlePlaceId":{"stringValue":"ChIJK4PYNECuEmsRvSE1uCrzgpE"},"capturedByUid":{"stringValue":"DTKuVmvPmNcJ2tFqNSMvxiu2Uq72"},"leadId":{"stringValue":"1732864"},"address":{"mapValue":{"fields":{"state":{"stringValue":"NSW"},"country":{"stringValue":"Australia"},"lat":{"doubleValue":-33.8669208},"lng":{"doubleValue":151.1917842},"street":{"stringValue":"8 Harvey Street"},"city":{"stringValue":"Pyrmont"},"zip":{"stringValue":"2009"}}}},"status":{"stringValue":"Converted"},"discoveryData":{"mapValue":{"fields":{"personSpokenWithName":{"stringValue":"Jed"},"scheduledTime":{"stringValue":"11am"},"discoverySignals":{"arrayValue":{"values":[{"stringValue":"Uses other couriers (<5kg)"}]}},"score":{"integerValue":"2"},"scoringReason":{"stringValue":"+2 for using other small couriers. +2 for inconvenience level. +5 for occurrence frequency. +5 for decision maker access."},"personSpokenWithTitle":{"stringValue":""},"occurrence":{"stringValue":"Daily"},"inconvenience":{"stringValue":"Somewhat inconvenient"},"personSpokenWithEmail":{"stringValue":"jedc@stratarepublic"},"personSpokenWithPhone":{"stringValue":"0498 234 792"},"routingTag":{"stringValue":"Product"},"decisionMakerTitle":{"stringValue":""},"decisionMakerEmail":{"stringValue":""},"decisionMakerName":{"stringValue":""},"personSpokenWithTags":{"arrayValue":{"values":[{"stringValue":"Decision Maker"}]}},"decisionMakerPhone":{"stringValue":""},"scheduledDate":{"mapValue":{}},"dashbackOpportunity":{"stringValue":""}}}},"capturedBy":{"stringValue":"Damien Doowage"},"franchisee":{"nullValue":null},"imageUrls":{"arrayValue":{}},"content":{"stringValue":"Strata company, mail and hand to hand. Currently use other couriers\n\nMeeting set for Tuesday 11am 3/3"},"companyName":{"stringValue":"Strata Republic"},"scheduledDate":{"stringValue":"2026-03-02T13:00:00.000Z"}}

					//{ "name": "projects/mailplus-outbound-leads-crm/databases/(default)/documents/visitnotes/QoBHFz6io7idHeUdXO53", "fields": { "outcome": { "mapValue": { "fields": { "type": { "stringValue": "Qualified - Set Appointment" }, "details": { "mapValue": { "fields": { "salesRep": { "stringValue": "Kerina Helliwell" } } } } } } }, "createdAt": { "stringValue": "2026-05-12T00:44:48.975Z" }, "leadId": { "stringValue": "1938360" }, "capturedByUid": { "stringValue": "K0RvxwW2ZkM0XWx5YWYExjcUEcj2" }, "discoveryData": { "mapValue": { "fields": { "dashbackOpportunity": { "stringValue": "" }, "decisionMakerEmail": { "stringValue": "" }, "personSpokenWithEmail": { "stringValue": "ankithravindran@mailplus.com.au" }, "routingTag": { "stringValue": "Service" }, "managementPathway": { "stringValue": "aus_post_managed" }, "personSpokenWithTitle": { "stringValue": "" }, "personSpokenWithTags": { "arrayValue": {} }, "scheduledDate": { "mapValue": {} }, "decisionMakerTitle": { "stringValue": "" }, "scheduledTime": { "stringValue": "14:00" }, "discoveryAnswers": { "arrayValue": { "values": [ { "mapValue": { "fields": { "pathway": { "stringValue": "aus_post_managed" }, "answer": { "stringValue": "this is test of australia post manager" }, "question": { "stringValue": "How often do you currently receive collections?" } } } }, { "mapValue": { "fields": { "pathway": { "stringValue": "aus_post_managed" }, "answer": { "stringValue": "this is test of australia post manager" }, "question": { "stringValue": "Are you looking to change anything about your current setup?" } } } } ] } }, "decisionMakerName": { "stringValue": "" }, "personSpokenWithPhone": { "stringValue": "0402712233" }, "decisionMakerPhone": { "stringValue": "" }, "personSpokenWithName": { "stringValue": "Jane Doe" }, "pathwayNotes": { "mapValue": { "fields": { "q2": { "stringValue": "this is test of australia post manager" }, "q1": { "stringValue": "this is test of australia post manager" } } } }, "discoverySignals": { "arrayValue": {} }, "score": { "integerValue": "1" }, "scoringReason": { "stringValue": "+12 for Australia Post-Managed pathway (Optimization potential). +1 for decision maker access." } } } }, "franchisee": { "nullValue": null }, "content": { "stringValue": "this is test of australia post manager" },

					if (!isNullorEmpty(responseVisitNoteObj.fields)) {
						log.audit({
							title: "responseVisitNoteObj.fields",
							details: responseVisitNoteObj.fields
						});
						log.audit({
							title: "responseVisitNoteObj.fields.capturedBy",
							details: responseVisitNoteObj.fields.capturedBy
						});
						if (!isNullorEmpty(responseVisitNoteObj.fields.capturedBy)) {
							capturedBy = responseVisitNoteObj.fields.capturedBy.stringValue;
							customerRecord.setValue({
								fieldId: "custentity_check_in_sales_rep",
								value: capturedBy
							});
						}
						if (!isNullorEmpty(responseVisitNoteObj.fields.discoveryData)) {
							var discoveryDataMap =
								responseVisitNoteObj.fields.discoveryData.mapValue;

							log.audit({
								title: "discoveryDataMap",
								details: discoveryDataMap
							});

							//{"fields":{"managementPathway":{"stringValue":"self_managed"},"score":{"integerValue":"2"},"decisionMakerName":{"stringValue":""},"personSpokenWithEmail":{"stringValue":"ankith88@gmail.com"},"decisionMakerEmail":{"stringValue":""},"personSpokenWithTitle":{"stringValue":""},"pathwayNotes":{"mapValue":{"fields":{"q1":{"stringValue":"test"},"q2":{"stringValue":"test"}}}},"routingTag":{"stringValue":"Service"},"dashbackOpportunity":{"stringValue":""},"businessType":{"stringValue":"Retail"},"scheduledTime":{"stringValue":""},"personSpokenWithTags":{"arrayValue":{}},"discoverySignals":{"arrayValue":{}},"decisionMakerTitle":{"stringValue":""},"scoringReason":{"stringValue":"+20 for Self-Managed pathway (High service potential). +1 for decision maker access."},"personSpokenWithName":{"stringValue":"ANKITH RAVINDRAN"},"personSpokenWithPhone":{"stringValue":"0402712233"},"discoveryAnswers":{"arrayValue":{"values":[{"mapValue":{"fields":{"pathway":{"stringValue":"self_managed"},"question":{"stringValue":"How often do you visit the post office?"},"answer":{"stringValue":"test"}}}},{"mapValue":{"fields":{"question":{"stringValue":"What is the biggest inconvenience of doing this yourself?"},"pathway":{"stringValue":"self_managed"},"answer":{"stringValue":"test"}}}}]}},"decisionMakerPhone":{"stringValue":""}}}

							if (!isNullorEmpty(discoveryDataMap.fields.managementPathway)) {
								managementPathway =
									discoveryDataMap.fields.managementPathway.stringValue;
								customerRecord.setValue({
									fieldId: "custentity_pp_managed_pathway",
									value: managementPathway
								});
							}
							if (!isNullorEmpty(discoveryDataMap.fields.pathwayNotes)) {
								var pathwayNotesMap =
									discoveryDataMap.fields.pathwayNotes.mapValue;

								log.audit({
									title: "pathwayNotesMap",
									details: pathwayNotesMap
								});
								if (!isNullorEmpty(pathwayNotesMap.fields)) {
									if (!isNullorEmpty(pathwayNotesMap.fields.q1)) {
										managementPathwayQ1 = pathwayNotesMap.fields.q1.stringValue;
										customerRecord.setValue({
											fieldId: "custentity_pp_managed_pathway_q1",
											value: managementPathwayQ1
										});
									}
									if (!isNullorEmpty(pathwayNotesMap.fields.q2)) {
										managementPathwayQ2 = pathwayNotesMap.fields.q2.stringValue;
										customerRecord.setValue({
											fieldId: "custentity_pp_managed_pathway_q2",
											value: managementPathwayQ2
										});
									}
								}
							}

							if (!isNullorEmpty(discoveryDataMap.fields.businessType)) {
								var businessType =
									discoveryDataMap.fields.businessType.stringValue;
								customerRecord.setValue({
									fieldId: "custentity_checkin_q1",
									value: businessType
								});
							}

							if (!isNullorEmpty(discoveryDataMap.fields.discoverySignals)) {
								var discoverySignalsArray =
									discoveryDataMap.fields.discoverySignals.arrayValue.values;

								if (!isNullorEmpty(discoverySignalsArray)) {
									for (var d = 0; d < discoverySignalsArray.length; d++) {
										if (d == 0) {
											discoverySignals += discoverySignalsArray[d].stringValue;
										} else {
											discoverySignals +=
												"; " + discoverySignalsArray[d].stringValue;
										}
									}
									customerRecord.setValue({
										fieldId: "custentity_checkin_q2",
										value: discoverySignals
									});
								}
							}

							if (!isNullorEmpty(discoveryDataMap.fields.inconvenience)) {
								var inconvenience =
									discoveryDataMap.fields.inconvenience.stringValue;
								customerRecord.setValue({
									fieldId: "custentity_checkin_q3",
									value: inconvenience
								});
							}

							if (!isNullorEmpty(discoveryDataMap.fields.occurrence)) {
								var occurrence = discoveryDataMap.fields.occurrence.stringValue;
								customerRecord.setValue({
									fieldId: "custentity_checkin_q4",
									value: occurrence
								});
							}

							if (!isNullorEmpty(discoveryDataMap.fields.routingTag)) {
								var routingTag = discoveryDataMap.fields.routingTag.stringValue;
								customerRecord.setValue({
									fieldId: "custentity_checkin_routing_tag",
									value: routingTag
								});
							}
							if (!isNullorEmpty(discoveryDataMap.fields.score)) {
								var score = discoveryDataMap.fields.score.integerValue;
								customerRecord.setValue({
									fieldId: "custentity_checkin_score",
									value: score
								});
							}
							if (!isNullorEmpty(discoveryDataMap.fields.scoringReason)) {
								var scoringReason =
									discoveryDataMap.fields.scoringReason.stringValue;
								customerRecord.setValue({
									fieldId: "custentity_checkin_scoring_reason",
									value: scoringReason
								});
							}

							if (
								!isNullorEmpty(discoveryDataMap.fields.personSpokenWithName)
							) {
								personSpokenWithName =
									discoveryDataMap.fields.personSpokenWithName.stringValue;
							}
							if (
								!isNullorEmpty(discoveryDataMap.fields.personSpokenWithEmail)
							) {
								personSpokenWithEmail =
									discoveryDataMap.fields.personSpokenWithEmail.stringValue;
							}
							if (
								!isNullorEmpty(discoveryDataMap.fields.personSpokenWithPhone)
							) {
								personSpokenWithPhone =
									discoveryDataMap.fields.personSpokenWithPhone.stringValue;
							}
						}
						if (!isNullorEmpty(responseVisitNoteObj.fields.outcome)) {
							var visitNoteOutcomeMap =
								responseVisitNoteObj.fields.outcome.mapValue;

							if (!isNullorEmpty(visitNoteOutcomeMap.fields.type)) {
								visitNoteOutcomeType =
									visitNoteOutcomeMap.fields.type.stringValue;
								customerRecord.setValue({
									fieldId: "custentity_checkin_outcome",
									value: visitNoteOutcomeType
								});
							}
						}

						if (!isNullorEmpty(responseVisitNoteObj.fields.content)) {
							var content = responseVisitNoteObj.fields.content.stringValue;
							log.debug({
								title: "Visit Note Content",
								details: content
							});
							if (!isNullorEmpty(content)) {
								var userNoteRecord = record.create({
									type: record.Type.NOTE,
									isDynamic: true
								});

								userNoteRecord.setValue({
									fieldId: "entity",
									value: parseInt(internalid)
								});

								userNoteRecord.setValue({
									fieldId: "title",
									value: "ProspectPlus - Notes"
								});

								userNoteRecord.setValue({
									fieldId: "direction",
									value: 1
								});

								userNoteRecord.setValue({
									fieldId: "notetype",
									value: 7
								});

								userNoteRecord.setValue({
									fieldId: "custrecord_note_prospectplus_sdr",
									value: 1952193
								});
								userNoteRecord.setValue({
									fieldId: "author",
									value: 1952193
								});

								userNoteRecord.setValue({
									fieldId: "notedate",
									value: getDateStoreNS()
								});

								userNoteRecord.setValue({
									fieldId: "note",
									value: content
								});

								var userNoteRecordId = userNoteRecord.save();
							}
						}
					}
				}

				//READ AND SYNC CONTACTS
				var firebaseLeadContactURL =
					"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
					internalid +
					"/contacts";

				var responseLeadContactDocuments = https.request({
					method: https.Method.GET,
					url: firebaseLeadContactURL,
					headers: apiHeaders
				});

				var dbLeadContactBody = responseLeadContactDocuments.body;

				log.audit({
					title: "dbLeadContactBody",
					details: dbLeadContactBody
				});

				//{ "documents": [ { "name": "projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/1938360/contacts/GBtrrZyayZNH6GnkCDTo", "fields": { "syncedWithNetSuite": { "booleanValue": true }, "name": { "stringValue": "ANKITH RAVINDRAN" }, "phone": { "stringValue": "0402712233" }, "title": { "stringValue": "" }, "email": { "stringValue": "ankith88@gmail.com" } }, "createTime": "2026-05-14T20:25:12.141006Z", "updateTime": "2026-05-14T20:33:10.558896Z" }, { "name": "projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/1938360/contacts/T4dfHl0YkJkX5Jer5P2k", "fields": { "title": { "stringValue": "Lead Gen manager" }, "email": { "stringValue": "aleyna.harnett@mailplus.com.au" }, "name": { "stringValue": "Aleyna" }, "syncedWithNetSuite": { "booleanValue": true }, "phone": { "stringValue": "0490048801" } }, "createTime": "2026-03-13T03:43:09.944962Z", "updateTime": "2026-03-25T00:59:48.182990Z" }, { "name": "projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/1938360/contacts/Wshk5mpRq7X53VbiGzCd", "fields": { "phone": { "stringValue": "0402712233" }, "syncedWithNetSuite": { "booleanValue": true }, "name": { "stringValue": "Jane Doe" }, "title": { "stringValue": "" }, "email": { "stringValue": "ankithravindran@mailplus.com.au" } }, "createTime": "2026-05-12T00:45:42.493703Z", "updateTime": "2026-05-14T20:44:17.877474Z" }, { "name": "projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/1938360/contacts/undefined", "fields": { "syncedWithNetSuite": { "booleanValue": true } }, "createTime": "2026-05-14T20:44:16.183049Z", "updateTime": "2026-05-14T20:44:16.183049Z" } ] }

				var responseLeadContactObj = JSON.parse(dbLeadContactBody);

				var contactsArray = responseLeadContactObj.documents;
				var contactIDEmailToSend = null;
				//Iterate through Contacts
				if (!isNullorEmpty(contactsArray)) {
					for (var i = 0; i < contactsArray.length; i++) {
						log.debug({
							title: "Processing contactsArray[" + i + "]",
							details: contactsArray[i]
						});
						if (
							!isNullorEmpty(contactsArray[i].fields.name) &&
							!isNullorEmpty(contactsArray[i].fields.email) &&
							!isNullorEmpty(contactsArray[i].fields.phone)
						) {
							var contactName = contactsArray[i].fields.name.stringValue;
							var contactEmail = contactsArray[i].fields.email.stringValue;
							var contactPhone = contactsArray[i].fields.phone.stringValue;
							var contactTitle = contactsArray[i].fields.title.stringValue;
							// var contactAccessToLocalMile = contactsArray[i].fields.accessToLocalMile.stringValue;
							//Check if syncedWithNetSuite field exists
							if (!isNullorEmpty(contactsArray[i].fields.syncedWithNetSuite)) {
								var contactSyncedWithNetSuite =
									contactsArray[i].fields.syncedWithNetSuite.booleanValue;

								//SYNC NOTE IF NOT SYNCED
								if (
									contactSyncedWithNetSuite == false ||
									contactSyncedWithNetSuite == "false"
								) {
									log.audit({
										title:
											"contactsArray[" + i + "] being synced with NetSuite",
										details: contactsArray[i].toString()
									});

									var contactsID = contactsArray[i].name;
									var contactsID = contactsID.split(
										"/documents/leads/" + internalid + "/contacts/"
									)[1];

									if (!isNullorEmpty(contactEmail)) {
										var contactRecord = record.create({
											type: record.Type.CONTACT
										});

										contactRecord.setValue({
											fieldId: "company",
											value: internalid
										});

										if (contactName.indexOf(" ") != -1) {
											var contactNameSplit = contactName.split(" ");
											contactRecord.setValue({
												fieldId: "firstname",
												value: contactNameSplit[0]
											});
											contactRecord.setValue({
												fieldId: "lastname",
												value: contactNameSplit[1]
											});
										} else {
											contactRecord.setValue({
												fieldId: "firstname",
												value: contactName
											});
											contactRecord.setValue({
												fieldId: "lastname",
												value: contactName
											});
										}

										contactRecord.setValue({
											fieldId: "entityid",
											value: contactName
										});

										contactRecord.setValue({
											fieldId: "email",
											value: contactEmail
										});
										if (!isNullorEmpty(contactPhone) && contactPhone != "N/A") {
											contactRecord.setValue({
												fieldId: "phone",
												value: contactPhone
											});
										}

										if (!isNullorEmpty(contactTitle)) {
											contactRecord.setValue({
												fieldId: "title",
												value: contactTitle
											});
										}
										contactRecord.setValue({
											fieldId: "contactrole",
											value: -10
										});

										try {
											var contactId = contactRecord.save({
												ignoreMandatoryFields: true
											});

											var contactDetails = '{"fields": {';
											contactDetails +=
												'"syncedWithNetSuite": {"booleanValue": true}';
											contactDetails += "}}";

											if (!isNullorEmpty(contactsArray[i].fields.sendEmail)) {
												var contactSendEmail =
													contactsArray[i].fields.sendEmail.stringValue;
												if (contactSendEmail == "yes") {
													contactIDEmailToSend = contactId;
												}
											}

											var firebaseUpdateURL =
												"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
												internalid +
												"/notes/" +
												contactsID +
												"?updateMask.fieldPaths=syncedWithNetSuite";
											var apiHeaders = {};
											apiHeaders["Content-Type"] = "application/json";
											apiHeaders["Accept"] = "*/*";
											apiHeaders["X-HTTP-Method-Override"] = "PATCH";

											var responseNewContact = https.request({
												method: https.Method.POST,
												url: firebaseUpdateURL,
												body: contactDetails,
												headers: apiHeaders
											});

											log.debug({
												title: "Response New Contact",
												details: responseNewContact.body
											});
										} catch (error) {
											log.debug({
												title: "Error Creating Contact",
												details: error
											});
										}
									}
								} else {
									//Search: All Customer Contacts - With Emails
									var allActiveContactsSearch = search.load({
										type: "contact",
										id: "customsearch_contacts_mpex_contacts_2_2"
									});
									allActiveContactsSearch.filters.push(
										search.createFilter({
											name: "internalid",
											join: "customer",
											operator: search.Operator.ANYOF,
											values: internalid
										})
									);
									allActiveContactsSearch.filters.push(
										search.createFilter({
											name: "email",
											operator: search.Operator.IS,
											values: contactEmail
										})
									);
									var allActiveContactsSearchResultSet =
										allActiveContactsSearch.run();
									allActiveContactsSearchResultSet.each(function (resultSet) {
										var contactInternalId = resultSet.getValue({
											name: "internalid"
										});

										if (!isNullorEmpty(contactsArray[i].fields.sendEmail)) {
											var contactSendEmail =
												contactsArray[i].fields.sendEmail.stringValue;
											if (contactSendEmail == "yes") {
												contactIDEmailToSend = contactInternalId;
											}
										}

										var contactDetails = '{"fields": {';
										contactDetails +=
											'"syncedWithNetSuite": {"booleanValue": true}';
										contactDetails += "}}";

										var firebaseUpdateURL =
											"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
											internalid +
											"/contacts/" +
											contactsID +
											"?updateMask.fieldPaths=syncedWithNetSuite";
										var apiHeaders = {};
										apiHeaders["Content-Type"] = "application/json";
										apiHeaders["Accept"] = "*/*";
										apiHeaders["X-HTTP-Method-Override"] = "PATCH";

										var responseExistingContact = https.request({
											method: https.Method.POST,
											url: firebaseUpdateURL,
											body: contactDetails,
											headers: apiHeaders
										});
										log.debug({
											title: "Response Existing Contact",
											details: responseExistingContact
										});
										return true;
									});
								}
							}
						}
					}
				}
				//READ AND SYNC NOTES
				var firebaseLeadNoteURL =
					"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
					internalid +
					"/notes";

				var responseLeadNoteDocuments = https.request({
					method: https.Method.GET,
					url: firebaseLeadNoteURL,
					headers: apiHeaders
				});

				var dbLeadNoteBody = responseLeadNoteDocuments.body;

				log.audit({
					title: "dbLeadNoteBody",
					details: dbLeadNoteBody
				});

				var responseLeadNoteObj = JSON.parse(dbLeadNoteBody);

				var notesArray = responseLeadNoteObj.documents;

				//Iterate through Notes
				if (!isNullorEmpty(notesArray)) {
					for (var i = 0; i < notesArray.length; i++) {
						if (!isNullorEmpty(notesArray[i].fields.content)) {
							var noteContent = notesArray[i].fields.content.stringValue;
							var noteAuthor = notesArray[i].fields.author.stringValue;
							var noteCreatedAt = notesArray[i].fields.date.stringValue;
							//Check if syncedWithNetSuite field exists
							if (!isNullorEmpty(notesArray[i].fields.syncedWithNetSuite)) {
								var noteSyncedWithNetSuite =
									notesArray[i].fields.syncedWithNetSuite.booleanValue;

								//SYNC NOTE IF NOT SYNCED
								if (
									noteSyncedWithNetSuite == false ||
									noteSyncedWithNetSuite == "false"
								) {
									log.audit({
										title: "notesArray[" + i + "] being synced with NetSuite",
										details: notesArray[i]
									});

									var notesName = notesArray[i].name;
									var notesID = notesName.split(
										"/documents/leads/" + internalid + "/notes/"
									)[1];

									var userNoteRecord = record.create({
										type: record.Type.NOTE,
										isDynamic: true
									});

									userNoteRecord.setValue({
										fieldId: "entity",
										value: parseInt(internalid)
									});

									userNoteRecord.setValue({
										fieldId: "title",
										value: "ProspectPlus - Notes"
									});

									userNoteRecord.setValue({
										fieldId: "direction",
										value: 1
									});

									userNoteRecord.setValue({
										fieldId: "notetype",
										value: 7
									});

									userNoteRecord.setValue({
										fieldId: "custrecord_note_prospectplus_sdr",
										value: noteAuthor
									});
									userNoteRecord.setValue({
										fieldId: "author",
										value: 1874329
									});

									userNoteRecord.setValue({
										fieldId: "notedate",
										value: getDateStoreNS()
									});

									userNoteRecord.setValue({
										fieldId: "note",
										value: noteContent
									});

									var userNoteRecordId = userNoteRecord.save();

									var noteDetails = '{"fields": {';
									noteDetails += '"syncedWithNetSuite": {"booleanValue": true}';
									noteDetails += "}}";

									var firebaseUpdateURL =
										"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
										internalid +
										"/notes/" +
										notesID +
										"?updateMask.fieldPaths=syncedWithNetSuite";
									var apiHeaders = {};
									apiHeaders["Content-Type"] = "application/json";
									apiHeaders["Accept"] = "*/*";
									apiHeaders["X-HTTP-Method-Override"] = "PATCH";

									var response = https.request({
										method: https.Method.POST,
										url: firebaseUpdateURL,
										body: noteDetails,
										headers: apiHeaders
									});
								}
							}
						}
					}
				}

				log.audit({
					title: "Lead's Notes synced in NetSuite from Firebase",
					details: ""
				});

				//READ AND SYNC ACTIVITIES
				var apiHeaders = {};
				apiHeaders["Content-Type"] = "application/json";
				apiHeaders["Accept"] = "*/*";
				apiHeaders["Authorization"] = "Bearer " + idToken;
				var firebaseLeadActivityURL =
					"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
					internalid +
					"/activity";

				var responseLeadActivityDocuments = https.request({
					method: https.Method.GET,
					url: firebaseLeadActivityURL,
					headers: apiHeaders
				});

				var dbLeadActivityBody = responseLeadActivityDocuments.body;

				log.audit({
					title: "dbLeadActivityBody",
					details: dbLeadActivityBody
				});

				var responseLeadActivityObj = JSON.parse(dbLeadActivityBody);

				var activityArray = responseLeadActivityObj.documents;
				//Iterate through Activities
				if (!isNullorEmpty(activityArray)) {
					for (var i = 0; i < activityArray.length; i++) {
						var activityType = activityArray[i].fields.type.stringValue;
						var activityNotes = activityArray[i].fields.notes.stringValue;

						//Check if activity
						if (activityType == "Call") {
							if (!isNullorEmpty(activityArray[i].fields.callId)) {
								var activityCallId = activityArray[i].fields.callId.stringValue;

								//SYNC ACTIVITY IF NOT SYNCED
								if (
									!isNullorEmpty(activityArray[i].fields.syncedWithNetSuite)
								) {
									var activitySyncedWithNetSuite =
										activityArray[i].fields.syncedWithNetSuite.booleanValue;

									if (
										(activitySyncedWithNetSuite == false ||
											activitySyncedWithNetSuite == "false") &&
										!isNullorEmpty(activityCallId)
									) {
										log.audit({
											title:
												"activityArray[" + i + "] being synced with NetSuite",
											details: activityArray[i]
										});

										var activityAuthor =
											activityArray[i].fields.author.stringValue;
										var activityDuration =
											activityArray[i].fields.duration.stringValue;
										var activityNotes =
											activityArray[i].fields.notes.stringValue;

										var phoneCallMessage =
											"AirCall ID: " +
											activityCallId +
											"\n" +
											"Aicall Recording Link: https://assets.aircall.io/calls/" +
											activityCallId +
											"/recording/info \n" +
											"Date: " +
											getDateStoreNS() +
											"\n" +
											"SDR: " +
											activityAuthor +
											"\n" +
											"Duration: " +
											activityDuration +
											"\n" +
											"Notes: " +
											activityNotes;

										var phoneCallRecord = record.create({
											type: record.Type.PHONE_CALL,
											isDynamic: true
										});

										phoneCallRecord.setValue({
											fieldId: "company",
											value: parseInt(internalid)
										});

										phoneCallRecord.setValue({
											fieldId: "startdate",
											value: getDateStoreNS()
										});

										phoneCallRecord.setValue({
											fieldId: "custevent_organiser",
											value: 1874329
										});

										phoneCallRecord.setValue({
											fieldId: "custevent_call_type",
											value: 1
										});

										phoneCallRecord.setValue({
											fieldId: "title",
											value:
												"ProspectPlus Qualification - AirCall Call ID: " +
												activityCallId
										});

										phoneCallRecord.setValue({
											fieldId: "assigned",
											value: 1874329
										});

										phoneCallRecord.setValue({
											fieldId: "message",
											value: phoneCallMessage
										});

										phoneCallRecord.setValue({
											fieldId: "status",
											value: "COMPLETE"
										});

										var phoneCallRecordId = phoneCallRecord.save();

										var userNoteRecord = record.create({
											type: record.Type.NOTE,
											isDynamic: true
										});

										userNoteRecord.setValue({
											fieldId: "entity",
											value: parseInt(internalid)
										});

										userNoteRecord.setValue({
											fieldId: "title",
											value: "ProspectPlus - Notes"
										});

										userNoteRecord.setValue({
											fieldId: "direction",
											value: 1
										});

										userNoteRecord.setValue({
											fieldId: "notetype",
											value: 7
										});

										userNoteRecord.setValue({
											fieldId: "custrecord_note_prospectplus_sdr",
											value: activityAuthor
										});
										userNoteRecord.setValue({
											fieldId: "author",
											value: 1874329
										});

										userNoteRecord.setValue({
											fieldId: "notedate",
											value: getDateStoreNS()
										});

										userNoteRecord.setValue({
											fieldId: "note",
											value: activityNotes
										});

										var userNoteRecordId = userNoteRecord.save();

										var activityName = activityArray[i].name;

										var activityID = activityName.split(
											"/documents/leads/" + internalid + "/activity/"
										)[1];

										var activityDetails = '{"fields": {';
										activityDetails +=
											'"syncedWithNetSuite": {"booleanValue": true}';
										activityDetails += "}}";

										var firebaseUpdateURL =
											"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
											internalid +
											"/activity/" +
											activityID +
											"?updateMask.fieldPaths=syncedWithNetSuite";
										var apiHeaders = {};
										apiHeaders["Content-Type"] = "application/json";
										apiHeaders["Accept"] = "*/*";
										apiHeaders["X-HTTP-Method-Override"] = "PATCH";

										var response = https.request({
											method: https.Method.POST,
											url: firebaseUpdateURL,
											body: activityDetails,
											headers: apiHeaders
										});

										log.audit({
											title:
												"Updating activityArray[" +
												i +
												"] as Note - firebaseUpdateURL",
											details: firebaseUpdateURL
										});
									}
								}
							} else if (!isNullorEmpty(activityArray[i].fields.author)) {
								log.audit({
									title:
										"activityArray[" +
										i +
										"] skipped - No Call ID found, saving as Note instead",
									details: activityArray[i]
								});

								//SYNC ACTIVITY IF NOT SYNCED
								if (
									!isNullorEmpty(activityArray[i].fields.syncedWithNetSuite)
								) {
									var activitySyncedWithNetSuite =
										activityArray[i].fields.syncedWithNetSuite.booleanValue;

									if (
										activitySyncedWithNetSuite == false ||
										activitySyncedWithNetSuite == "false"
									) {
										log.audit({
											title:
												"activityArray[" +
												i +
												"] being synced as a Note with NetSuite",
											details: activityArray[i]
										});

										var activityAuthor =
											activityArray[i].fields.author.stringValue;
										var activityNotes =
											activityArray[i].fields.notes.stringValue;

										//Save as User Note in NetSuite
										var userNoteRecord = record.create({
											type: record.Type.NOTE,
											isDynamic: true
										});

										userNoteRecord.setValue({
											fieldId: "entity",
											value: parseInt(internalid)
										});

										userNoteRecord.setValue({
											fieldId: "title",
											value: "ProspectPlus - Notes"
										});

										userNoteRecord.setValue({
											fieldId: "direction",
											value: 1
										});

										userNoteRecord.setValue({
											fieldId: "notetype",
											value: 7
										});

										userNoteRecord.setValue({
											fieldId: "custrecord_note_prospectplus_sdr",
											value: activityAuthor
										});
										userNoteRecord.setValue({
											fieldId: "author",
											value: 1874329
										});

										userNoteRecord.setValue({
											fieldId: "notedate",
											value: getDateStoreNS()
										});

										userNoteRecord.setValue({
											fieldId: "note",
											value: activityNotes
										});

										var userNoteRecordId = userNoteRecord.save();

										var activityName = activityArray[i].name;

										var activityID = activityName.split(
											"/documents/leads/" + internalid + "/activity/"
										)[1];

										var activityDetails = '{"fields": {';
										activityDetails +=
											'"syncedWithNetSuite": {"booleanValue": true}';
										activityDetails += "}}";

										var firebaseUpdateURL =
											"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
											internalid +
											"/activity/" +
											activityID +
											"?updateMask.fieldPaths=syncedWithNetSuite";
										var apiHeaders = {};
										apiHeaders["Content-Type"] = "application/json";
										apiHeaders["Accept"] = "*/*";
										apiHeaders["X-HTTP-Method-Override"] = "PATCH";

										log.audit({
											title:
												"Updating activityArray[" +
												i +
												"] as Note - firebaseUpdateURL",
											details: firebaseUpdateURL
										});

										var response = https.request({
											method: https.Method.POST,
											url: firebaseUpdateURL,
											body: activityDetails,
											headers: apiHeaders
										});
									}
								}
							}
						} else if (
							activityType == "Update" &&
							activityNotes == "Checked in at location via map."
						) {
							//SYNC ACTIVITY IF NOT SYNCED
							if (!isNullorEmpty(activityArray[i].fields.syncedWithNetSuite)) {
								var activitySyncedWithNetSuite =
									activityArray[i].fields.syncedWithNetSuite.booleanValue;

								if (
									activitySyncedWithNetSuite == false ||
									activitySyncedWithNetSuite == "false"
								) {
									var userNoteRecord = record.create({
										type: record.Type.NOTE,
										isDynamic: true
									});

									userNoteRecord.setValue({
										fieldId: "entity",
										value: parseInt(internalid)
									});

									userNoteRecord.setValue({
										fieldId: "title",
										value: "ProspectPlus - Notes"
									});

									userNoteRecord.setValue({
										fieldId: "direction",
										value: 1
									});

									userNoteRecord.setValue({
										fieldId: "notetype",
										value: 7
									});

									userNoteRecord.setValue({
										fieldId: "author",
										value: 1874329
									});

									userNoteRecord.setValue({
										fieldId: "notedate",
										value: getDateStoreNS()
									});

									userNoteRecord.setValue({
										fieldId: "note",
										value: activityNotes
									});

									var userNoteRecordId = userNoteRecord.save();

									var activityName = activityArray[i].name;

									var activityID = activityName.split(
										"/documents/leads/" + internalid + "/activity/"
									)[1];

									var activityDetails = '{"fields": {';
									activityDetails +=
										'"syncedWithNetSuite": {"booleanValue": true}';
									activityDetails += "}}";

									var firebaseUpdateURL =
										"https://firestore.googleapis.com/v1/projects/mailplus-outbound-leads-crm/databases/(default)/documents/leads/" +
										internalid +
										"/activity/" +
										activityID +
										"?updateMask.fieldPaths=syncedWithNetSuite";
									var apiHeaders = {};
									apiHeaders["Content-Type"] = "application/json";
									apiHeaders["Accept"] = "*/*";
									apiHeaders["X-HTTP-Method-Override"] = "PATCH";

									var response = https.request({
										method: https.Method.POST,
										url: firebaseUpdateURL,
										body: activityDetails,
										headers: apiHeaders
									});

									log.audit({
										title:
											"Updating activityArray[" +
											i +
											"] as Note - firebaseUpdateURL",
										details: firebaseUpdateURL
									});
								}
							}
						}
					}
				}

				log.audit({
					title: "Lead's Activity synced in NetSuite from Firebase",
					details: ""
				});
			}

			//Sync to LocalMile Firebase Database

			//Check if fields does not exist, then sync with LocalMile

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
				value: 11 // Awaiting T&C's to be Accepted
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
				value: serviceRate
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

			var localmilePMPOInternalID = pmpoServiceInternalId;
			var localmilePMPORate = serviceRate;

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
				value: serviceRate
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

			//!No need to create a service record since we just need to create on an adhoc basis when the customer books a job from LocalMile, since the rate is dynamic based on the delivery address. The rate is got from LocalMile via the API during booking.

			//Create the customerDetails2 JSON to be sent to LocalMile.Plus Firebase Database. Needs to match above example.
			var customerDetails2 = {};
			customerDetails2.address1 = shippingAddress1;
			customerDetails2.city = shippingCity;
			customerDetails2.companyId = internalid;
			customerDetails2.companyName = companyName;
			customerDetails2.customerEmail = customerEmail;
			customerDetails2.customerEntityId = customerEntityId;
			customerDetails2.customerPhone = customerPhone;
			customerDetails2.customerServiceEmail = customerServiceEmail;
			customerDetails2.extraWeightCharges = "3.50";
			customerDetails2.franchisee = franchiseeInternalID;
			customerDetails2.franchiseeTerritoryJSON = [];
			zeeSuburbMappingJSON.forEach(function (suburb) {
				var stringValue =
					suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
				customerDetails2.franchiseeTerritoryJSON.push(stringValue);
			});
			customerDetails2.servicePMPOInternalID = localmilePMPOInternalID;
			customerDetails2.servicePMPORate = localmilePMPORate;
			customerDetails2.state = shippingStateProvince;
			customerDetails2.street = shippingAddress2;
			customerDetails2.zip = shippingZip;
			customerDetails2.customer_id = internalid;
			customerDetails2.email = contactEmail;
			customerDetails2.first_name = contactFirstName;
			customerDetails2.last_name = contactLastName;
			customerDetails2.mobile = contactPhone;
			customerDetails2.parent_id = "";
			customerDetails2.role = "customer";
			customerDetails2.hasCompletedTour = false;

			var customerDetails = '{"fields": {';
			customerDetails += '"companyId": {"stringValue": "' + internalid + '"},';
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
			//remove thee last character if it is a comma
			if (customerDetails.slice(-1) == ",") {
				customerDetails = customerDetails.slice(0, -1);
			}
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
			customerDetails +=
				'"customer_id": {"stringValue": "' + internalid + '"},';
			customerDetails += '"email": {"stringValue": "' + contactEmail + '"},';
			customerDetails +=
				'"first_name": {"stringValue": "' + contactFirstName + '"},';
			customerDetails +=
				'"last_name": {"stringValue": "' + contactLastName + '"},';
			customerDetails += '"mobile": {"stringValue": "' + contactPhone + '"},';
			customerDetails += '"parent_id": {"stringValue": ""},';
			customerDetails += '"role": {"stringValue": "customer"},';
			customerDetails += '"hasCompletedTour": {"stringValue": "false"}';

			customerDetails += "}}";

			log.debug({
				title: "customerDetails",
				details: customerDetails
			});

			log.debug({
				title: "customerDetails2",
				details: customerDetails2
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

			var myresponse_body = response.body;
			var myresponse_code = response.code;

			log.debug({
				title: "LocalMile Plus API Response Code",
				details: myresponse_code
			});
			log.debug({
				title: "LocalMile Plus API Response Body",
				details: myresponse_body
			});

			var responseObj = JSON.parse(myresponse_body);

			log.debug({
				title: "responseObj",
				details: responseObj
			});
			//{"success":true,"message":"Account provisioned successfully.","data":{"uid":"Zv6hSb4nisNyqhZ6WIRRQnXFQ162","companyId":"1938360","securityCode":"8707"}}

			log.debug({
				title: "responseObj.data.securityCode",
				details: responseObj.data.securityCode
			});
			log.debug({
				title: "responseObj.data.uid",
				details: responseObj.data.uid
			});

			var securityCodeNumber = responseObj.data.securityCode;
			var uuidLocalMilePlus = responseObj.data.uid;

			var localMilePlusAuthLink =
				"https://localmile.plus/activate/" + uuidLocalMilePlus;

			log.audit({
				title: "Lead synced to LocalMile Firebase Database",
				details: ""
			});

			customerRecord.setValue({
				fieldId: "custentity_localmile_sync",
				value: 1
			});

			customerRecord.setValue({
				fieldId: "entitystatus",
				value: 83 //LocalMile Pending
			});

			var customerRecordId = customerRecord.save({
				ignoreMandatoryFields: true
			});

			var returnObj = {
				success: true,
				securityCode: securityCodeNumber,
				localMilePlusAuthLink: localMilePlusAuthLink,
				leadID: internalid,
				message: "Lead Synced to LocalMile",
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
