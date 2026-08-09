/** 
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 
 * Author:               Ankith Ravindran
 * Created on:           2026-07-02 08:33:28
 * Modified on:          2026-07-02 08:33:33
 * SuiteScript Version:  2.0 
 * Description:          Suitelet API to Sync Im SubCustomer to LocalMile.Plus Firebase. 
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

      // //GENERATE THE ACCESS TOKEN USING LOGIN CREDENTIALS
      // var tokenBody =
      //   '{"email":"ankith.ravindran@mailplus.com.au","password":"123456aA","returnSecureToken":true}';

      // var apiHeaders = {};
      // apiHeaders["Content-Type"] = "application/json";

      // var responseAccessToken = https.request({
      //   method: https.Method.POST,
      //   url: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCEKfFKLTso-t3Lu6YV8XOpCCBF2az9Hcg",
      //   headers: apiHeaders,
      //   body: tokenBody
      // });

      // log.debug({
      //   title: "Firebase Access Token Response",
      //   details: responseAccessToken.body
      // });

      // var responseAccessTokenObj = JSON.parse(responseAccessToken.body);

      // var idToken = responseAccessTokenObj.idToken;
      // idToken = 'ya29.a0ATi6K2uGzEXpA07xm1-OI2-D9r41aWvNVY41S-Vnc4HXGKC6h4sbss8KmNWJIr_4Kb3XBMIjS8HNxwCTfHwQDJl5aupTem3HWohun97glrBvdUATOQcHkRTHyruqFZ1tYV5-lO6xv5o5k_P-MmmQ-xnLKA0FFuA7eaAvaIWledMhISrjZslqYeOca8O6kfBe7nl2wYcaCgYKAawSARASFQHGX2Mik7hiK6ZgPGfhVO_d8ecJ-A0206'
      // var refreshToken = responseAccessTokenObj.refreshToken;

      log.audit({
        title: "context.request.parameters",
        details: context.request.parameters
      });

      //IM SubCustomer Internal ID
      var customerInternalId = context.request.parameters.customerInternalId;

      //Load IM SubCustomer Record
      var customer_record = record.load({
        type: record.Type.LEAD,
        id: customerInternalId
      });

      var customerCompanyName = customer_record.getValue({
        fieldId: "companyname"
      });
      var customerEntityID = customer_record.getValue({
        fieldId: "entityid"
      });

      //Billing Type
      var billingType = customer_record.getValue({
        fieldId: "custentity_im_invoice_payment"
      });

      //Get Parent Account of Subcustomer linked to MP
      var parentIMInternalId = customer_record.getValue({
        fieldId: "parent"
      });

      log.debug({
        title: "parentIMInternalId",
        details: parentIMInternalId
      });

      var parentCustomerRecord = record.load({
        type: record.Type.LEAD,
        id: parentIMInternalId
      });

      var imName = parentCustomerRecord.getValue({
        fieldId: "companyname"
      });
      //Actual Parent Name: IM - QLD GOV - Parent.
      //Need to strip away IM - and - Parent.
      var imCompanyName = imName;
      if (!isNullorEmpty(imCompanyName)) {
        if (imCompanyName.indexOf("IM - ") === 0) {
          imCompanyName = imCompanyName.substring(5);
        }
        if (imCompanyName.slice(-9) === " - Parent") {
          imCompanyName = imCompanyName.slice(0, -9);
        }
        imCompanyName = imCompanyName.trim();
      }
      var imParentName = imCompanyName;
      var imLinkedZees = parentCustomerRecord.getValue({
        fieldId: "custentity_im_linked_franchisees"
      });

      var imLinkedZeesArray = [];
      if (!isNullorEmpty(imLinkedZees)) {
        imLinkedZees = imLinkedZees.toString();
        log.debug({
          title: "imLinkedZees",
          details: imLinkedZees
        });
        if (imLinkedZees.indexOf(",") != -1) {
          imLinkedZeesArray = imLinkedZees.split(",");
        } else {
          imLinkedZeesArray = [];
          imLinkedZeesArray.push(imLinkedZees);
        }
      }
      log.debug({
        title: "imLinkedZeesArray",
        details: imLinkedZeesArray
      });

      // var linkedZeeDetails = '"linkedZeeDetails": {"arrayValue": { "values": [';

      for (var lllz = 0; lllz < imLinkedZeesArray.length; lllz++) {
        var customerPartnerRecord = record.load({
          type: "partner",
          id: imLinkedZeesArray[lllz]
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

        // var stringValue =
        // 	mainContactName + "," + partnerEmail + "," + partnerPhone;
        // linkedZeeDetails += '{"stringValue": "' + stringValue + '"},';
      }
      //remove thee last character if it is a comma
      // if (linkedZeeDetails.slice(-1) == ",") {
      // 	linkedZeeDetails = linkedZeeDetails.slice(0, -1);
      // }
      // linkedZeeDetails += "]}}";

      log.audit({
        title: "Linked Zee Details",
        details: imLinkedZeesArray
      });

      //Get Contact Details of SubCustomer
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
          values: parseInt(customerInternalId)
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

      //Get the Address of the SubCustomer
      //NetSuite Search: Customer List - Site Addresses
      var searched_addresses = search.load({
        id: "customsearch_cust_list_site_addresses",
        type: "customer"
      });

      searched_addresses.filters.push(
        search.createFilter({
          name: "internalid",
          operator: search.Operator.ANYOF,
          values: customerInternalId
        })
      );

      var subCustomerAddress1 = "";
      var subCustomerStreet = "";
      var subCustomerSuburb = "";
      var subCustomerState = "";
      var subCustomerPostcode = "";
      var subCustomerLatitude = "";
      var subCustomerLongitude = "";

      searched_addresses.run().each(function (resultSetAddresses) {
        subCustomerAddress1 = resultSetAddresses.getValue({
          name: "address1",
          join: "Address"
        });
        subCustomerStreet = resultSetAddresses.getValue({
          name: "address2",
          join: "Address"
        });
        subCustomerSuburb = resultSetAddresses.getValue({
          name: "city",
          join: "Address"
        });
        subCustomerState = resultSetAddresses.getText({
          name: "state",
          join: "Address"
        });
        subCustomerPostcode = resultSetAddresses.getValue({
          name: "zipcode",
          join: "Address"
        });
        subCustomerLatitude = resultSetAddresses.getValue({
          name: "custrecord_address_lat",
          join: "Address"
        });
        subCustomerLongitude = resultSetAddresses.getValue({
          name: "custrecord_address_lon",
          join: "Address"
        });
        return true;
      });

      //Get the Address of the SubCustomer
      //NetSuite Search: Customer List - Billing Addresses
      var searched_addresses = search.load({
        id: "customsearch_cust_list_billing_addresses",
        type: "customer"
      });

      searched_addresses.filters.push(
        search.createFilter({
          name: "internalid",
          operator: search.Operator.ANYOF,
          values: customerInternalId
        })
      );

      var subCustomerBillingAddresses = [];

      searched_addresses.run().each(function (resultSetAddresses) {
        subCustomerBillingAddresses.push({
          address1:
            resultSetAddresses.getValue({
              name: "address1",
              join: "Address"
            }) || "",
          street:
            resultSetAddresses.getValue({
              name: "address2",
              join: "Address"
            }) || "",
          city:
            resultSetAddresses.getValue({
              name: "city",
              join: "Address"
            }) || "",
          state:
            resultSetAddresses.getText({
              name: "state",
              join: "Address"
            }) || "",
          zip:
            resultSetAddresses.getValue({
              name: "zipcode",
              join: "Address"
            }) || "",
          latitude:
            resultSetAddresses.getValue({
              name: "custrecord_address_lat",
              join: "Address"
            }) || "",
          longitude:
            resultSetAddresses.getValue({
              name: "custrecord_address_lon",
              join: "Address"
            }) || "",
          partnerLocation:
            resultSetAddresses.getText({
              name: "custrecord_address_ncl",
              join: "Address"
            }) || ""
        });
        return true;
      });

      var primaryBillingAddress =
        subCustomerBillingAddresses.length > 0
          ? subCustomerBillingAddresses[0]
          : {
              address1: "",
              street: "",
              city: "",
              state: "",
              zip: "",
              latitude: "",
              longitude: "",
              partnerLocation: ""
            };

      var subCustomerBillingAddress1 = primaryBillingAddress.address1;
      var subCustomerBillingStreet = primaryBillingAddress.street;
      var subCustomerBillingSuburb = primaryBillingAddress.city;
      var subCustomerBillingState = primaryBillingAddress.state;
      var subCustomerBillingPostcode = primaryBillingAddress.zip;
      var subCustomerBillingLatitude = primaryBillingAddress.latitude;
      var subCustomerBillingLongitude = primaryBillingAddress.longitude;
      var subCustomerBillingPartnerLocation =
        primaryBillingAddress.partnerLocation;

      //Get the Address of the IM
      //NetSuite Search: Customer List - Site Addresses
      var searched_addresses = search.load({
        id: "customsearch_cust_list_site_addresses",
        type: "customer"
      });

      searched_addresses.filters.push(
        search.createFilter({
          name: "internalid",
          operator: search.Operator.ANYOF,
          values: parentIMInternalId
        })
      );

      var imAddress1 = "";
      var imStreet = "";
      var imSuburb = "";
      var imState = "";
      var imPostcode = "";
      var imLatitude = "";
      var imLongitude = "";

      searched_addresses.run().each(function (resultSetAddresses) {
        imAddress1 = resultSetAddresses.getValue({
          name: "address1",
          join: "Address"
        });
        imStreet = resultSetAddresses.getValue({
          name: "address2",
          join: "Address"
        });
        imSuburb = resultSetAddresses.getValue({
          name: "city",
          join: "Address"
        });
        imState = resultSetAddresses.getText({
          name: "state",
          join: "Address"
        });
        imPostcode = resultSetAddresses.getValue({
          name: "zipcode",
          join: "Address"
        });
        imLatitude = resultSetAddresses.getValue({
          name: "custrecord_address_lat",
          join: "Address"
        });
        imLongitude = resultSetAddresses.getValue({
          name: "custrecord_address_lon",
          join: "Address"
        });
        return true;
      });

      //Get Contact Details of IM
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
          values: parseInt(parentIMInternalId)
        })
      );
      resultSetContacts = searched_contacts.run();

      var serviceContactResult = resultSetContacts.getRange({
        start: 0,
        end: 1
      });

      var primaryIMContactInternalID = "";
      var imContactFirstName = "";
      var imContactLastName = "";
      var imContactEmail = "";
      var imContactPhone = "";
      if (serviceContactResult.length == 1) {
        primaryIMContactInternalID = serviceContactResult[0].getValue({
          name: "internalid"
        });
        imContactFirstName = serviceContactResult[0].getValue({
          name: "firstname"
        });
        imContactLastName = serviceContactResult[0].getValue({
          name: "lastname"
        });
        imContactEmail = serviceContactResult[0].getValue({
          name: "email"
        });
        imContactPhone = serviceContactResult[0].getValue({
          name: "phone"
        });
      }

      //Search: IM Sub Customer - Active Services List
      var imSubCustomerListSearch = search.load({
        type: "customer",
        id: "customsearch_im_sub_customer_serv_list"
      });

      imSubCustomerListSearch.filters.push(
        search.createFilter({
          name: "internalid",
          join: null,
          operator: search.Operator.ANYOF,
          values: customerInternalId
        })
      );
      // imSubCustomerListSearch.filters.push(
      // 	search.createFilter({
      // 		name: "partner",
      // 		join: null,
      // 		operator: search.Operator.ANYOF,
      // 		values: lpoLinkedZeesArray
      // 	})
      // );

      var countServiceList = 0;
      var serviceList = [];
      var oldIMSubCustomerInternalId = 0;
      var imSubCustomerServiceToBeCreatedInternalID = 0;

      imSubCustomerListSearch.run().each(function (resultSet) {
        var imSubCustomerInternalID = resultSet.getValue({
          name: "internalid"
        });

        var service = {
          id: resultSet.getValue({
            name: "internalid",
            join: "CUSTRECORD_SERVICE_CUSTOMER"
          }),
          name: resultSet.getValue({
            name: "name",
            join: "CUSTRECORD_SERVICE_CUSTOMER"
          }),
          rate: resultSet.getValue({
            name: "custrecord_service_price",
            join: "CUSTRECORD_SERVICE_CUSTOMER"
          })
        };
        serviceList.push(service);
        if (
          oldIMSubCustomerInternalId != 0 &&
          oldIMSubCustomerInternalId != imSubCustomerInternalID
        ) {
          imSubCustomerServiceToBeCreatedInternalID =
            oldIMSubCustomerInternalId;
          return false; //Stop the loop if we have already processed the sub customer
        }

        oldIMSubCustomerInternalId = imSubCustomerInternalID;
        countServiceList++;
        return true;
      });

      if (countServiceList > 0) {
        imSubCustomerServiceToBeCreatedInternalID = oldIMSubCustomerInternalId;
      }

      log.debug({
        title: "imSubCustomerServiceToBeCreatedInternalID",
        details: imSubCustomerServiceToBeCreatedInternalID
      });
      log.debug({
        title: "serviceList",
        details: serviceList
      });

      //[{"id":"115228","name":"H2H","rate":"10.00"},{"id":"115229","name":"H2H 2","rate":"10.00"},{"id":"115230","name":"PMPO","rate":"10.00"},{"id":"115227","name":"AMPO","rate":"6.00"}]

      //Load Partner Record to get the AP Suburb Mapping JSON
      var activeOperator = [];
      var imSuburbMappingJSON = [];
      var finalZeeIDArray = [];
      var imLinkedZeeTextArray = [];
      var linkedZeeDetailsValues = [];
      for (var x = 0; x < imLinkedZeesArray.length; x++) {
        var partnerRecord = record.load({
          type: record.Type.PARTNER,
          id: imLinkedZeesArray[x]
        });

        var zeeJSONString = partnerRecord.getValue({
          fieldId: "custentity_ironmountain_suburbs_json"
        });
        var zeeName = partnerRecord.getValue({
          fieldId: "companyname"
        });

        var mainContactName = partnerRecord.getValue({
          fieldId: "custentity3"
        });
        var partnerPhone = partnerRecord.getValue({
          fieldId: "custentity2"
        });
        var partnerEmail = partnerRecord.getValue({
          fieldId: "email"
        });

        partnerPhone = partnerPhone.replace(/ /g, "");
        partnerPhone = partnerPhone.slice(1);
        partnerPhone = "+61" + partnerPhone;

        var stringValue =
          mainContactName + "," + partnerEmail + "," + partnerPhone;

        log.audit({
          title: "zeeJSONString",
          details: zeeJSONString
        });

        if (!isNullorEmpty(zeeJSONString)) {
          var zeeJSON = JSON.parse(zeeJSONString);
        } else {
          var zeeJSON = [];
        }

        log.audit({
          title: "zeeJSON",
          details: zeeJSON
        });
        log.audit({
          title: "city",
          details: subCustomerSuburb
        });
        log.audit({
          title: "state",
          details: subCustomerState
        });
        log.audit({
          title: "postcode",
          details: subCustomerPostcode
        });

        var suburbStatePostcodeExistsReturn = suburbStatePostcodeExists(
          zeeJSON,
          subCustomerSuburb,
          subCustomerState,
          subCustomerPostcode
        );

        log.audit({
          title: "suburbStatePostcodeExistsReturn",
          details: suburbStatePostcodeExistsReturn
        });

        if (suburbStatePostcodeExistsReturn) {
          finalZeeIDArray.push(imLinkedZeesArray[x]);
          imLinkedZeeTextArray.push(zeeName);
          linkedZeeDetailsValues.push({
            stringValue: stringValue
          });
          zeeJSON.forEach(function (suburb) {
            imSuburbMappingJSON.push(suburb);
            if (!isNullorEmpty(suburb.primary_op)) {
              if (Array.isArray(suburb.primary_op)) {
                for (var i = 0; i < suburb.primary_op.length; i++) {
                  activeOperator.push(suburb.primary_op[i]);
                }
              } else {
                activeOperator.push(suburb.primary_op);
              }
            }
          });
        }

        log.audit({
          title: "activeOperator",
          details: activeOperator
        });
        log.audit({
          title: "finalZeeIDArray",
          details: finalZeeIDArray
        });
      }

      log.audit({
        title: "linkedZeeDetailsValues",
        details: linkedZeeDetailsValues
      });

      activeOperator = removeDuplicates(activeOperator);

      log.audit({
        title: "activeOperator",
        details: activeOperator
      });
      log.audit({
        title: "finalZeeIDArray",
        details: finalZeeIDArray
      });
      log.audit({
        title: "imLinkedZeeTextArray",
        details: imLinkedZeeTextArray
      });

      //Remove duplicates from imSuburbMappingJSON based on the suburb, state and postcode combination
      imSuburbMappingJSON =
        removeDuplicatesBySuburbStatePostcode(imSuburbMappingJSON);

      log.debug({
        title: "imSuburbMappingJSON",
        details: imSuburbMappingJSON
      });
      log.debug({
        title: "activeOperator",
        details: activeOperator
      });

      var franchiseeTerritoryValues = [];
      imSuburbMappingJSON.forEach(function (suburb) {
        var stringValue =
          suburb.suburbs + ", " + suburb.state + " " + suburb.post_code;
        franchiseeTerritoryValues.push({
          stringValue: stringValue
        });
      });

      var parentContactName =
        (isNullorEmpty(imContactFirstName) ? "" : imContactFirstName) +
        (isNullorEmpty(imContactLastName)
          ? ""
          : (isNullorEmpty(imContactFirstName) ? "" : " ") + imContactLastName);

      var serviceListValues = [];
      for (var sl = 0; sl < serviceList.length; sl++) {
        serviceListValues.push({
          mapValue: {
            fields: {
              id: { stringValue: String(serviceList[sl].id || "") },
              name: { stringValue: String(serviceList[sl].name || "") },
              rate: { stringValue: String(serviceList[sl].rate || "") }
            }
          }
        });
      }

      var billingAddressValues = [];
      for (var ba = 0; ba < subCustomerBillingAddresses.length; ba++) {
        billingAddressValues.push({
          mapValue: {
            fields: {
              address1: {
                stringValue: String(
                  subCustomerBillingAddresses[ba].address1 || ""
                )
              },
              street: {
                stringValue: String(
                  subCustomerBillingAddresses[ba].street || ""
                )
              },
              city: {
                stringValue: String(subCustomerBillingAddresses[ba].city || "")
              },
              state: {
                stringValue: String(subCustomerBillingAddresses[ba].state || "")
              },
              zip: {
                stringValue: String(subCustomerBillingAddresses[ba].zip || "")
              },
              latitude: {
                stringValue: String(
                  subCustomerBillingAddresses[ba].latitude || ""
                )
              },
              longitude: {
                stringValue: String(
                  subCustomerBillingAddresses[ba].longitude || ""
                )
              },
              partnerLocation: {
                stringValue: String(
                  subCustomerBillingAddresses[ba].partnerLocation || ""
                )
              }
            }
          }
        });
      }

      var customerDetails = {
        fields: {
          companyId: { stringValue: String(customerInternalId || "") },
          customerEntityId: { stringValue: String(customerEntityID || "") },
          companyName: { stringValue: customerCompanyName || "" },
          franchisee: { stringValue: finalZeeIDArray.join(",") },
          franchiseeText: { stringValue: imLinkedZeeTextArray.join(",") },
          franchiseeTerritoryJSON: {
            arrayValue: {
              values: franchiseeTerritoryValues
            }
          },
          customerPhone: { stringValue: customerContactPhone || "" },
          customerEmail: { stringValue: customerContactEmail || "" },
          customerServiceEmail: { stringValue: customerContactEmail || "" },
          billing: { stringValue: "Full Payment IM" },
          jobtype: { stringValue: "scheduled" },
          address1: { stringValue: subCustomerAddress1 || "" },
          street: { stringValue: subCustomerStreet || "" },
          city: { stringValue: subCustomerSuburb || "" },
          state: { stringValue: subCustomerState || "" },
          zip: { stringValue: subCustomerPostcode || "" },
          latitude: { stringValue: subCustomerLatitude || "" },
          longitude: { stringValue: subCustomerLongitude || "" },
          billingAddresses: {
            arrayValue: {
              values: billingAddressValues
            }
          },
          parentInternalID: { stringValue: String(parentIMInternalId || "") },
          parentName: { stringValue: imParentName || "" },
          firstName: { stringValue: customerContactFirstName || "" },
          first_name: { stringValue: customerContactFirstName || "" },
          lastName: { stringValue: customerContactLastName || "" },
          last_name: { stringValue: customerContactLastName || "" },
          parentAddress1: { stringValue: imAddress1 || "" },
          parentStreet: { stringValue: imStreet || "" },
          parentCity: { stringValue: imSuburb || "" },
          parentState: { stringValue: imState || "" },
          parentZip: { stringValue: imPostcode || "" },
          parentContactName: { stringValue: parentContactName },
          parentContactPhone: { stringValue: imContactPhone || "" },
          parentContactEmail: { stringValue: imContactEmail || "" },
          status: { stringValue: "Active" },
          serviceList: {
            arrayValue: {
              values: serviceListValues
            }
          },
          linkedZeeDetails: {
            arrayValue: {
              values: linkedZeeDetailsValues
            }
          }
        }
      };

      log.debug({
        title: "customerDetails",
        details: customerDetails
      });

      //{"fields": {"franchisee": {"stringValue": "425904,779884"},"franchiseeText": {"stringValue": "TEST - AR,TEST - NSW"},"franchiseeTerritoryJSON": {"arrayValue": { "values": [{"stringValue": "BEAUMONT HILLS, NSW 2155"},{"stringValue": "KELLYVILLE RIDGE, NSW 2155"},{"stringValue": "NORTH KELLYVILLE, NSW 2155"},{"stringValue": "KELLYVILLE, NSW 2155"},{"stringValue": "CASTLE HILL, NSW 2154"},{"stringValue": "KIRRAWEE, NSW 2232"},{"stringValue": "SUTHERLAND, NSW 2232"},{"stringValue": "SYDNEY, NSW 2000"},{"stringValue": "SCHOFIELDS, NSW 2762"}]}},"linkedZeeDetails": {"arrayValue": { "values": [{"stringValue": "Ankith Ravindran,ankith.ravindran@mailplus.com.au,+61402712233"},{"stringValue": "Fiona Harrison,fiona.harrison@mailplus.com.au,+61423847850"}]}}}}

      var localmileChecSubCustomerExistsURL =
        "https://localmile-plus.web.app/api/v1/companies/" +
        parentIMInternalId +
        "/customers/" +
        customerInternalId +
        "/exists";

      var apiHeaders = {};
      apiHeaders["Content-Type"] = "application/json";
      apiHeaders["x-api-key"] =
        "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

      var responseChecSubCustomerExists = https.request({
        method: https.Method.GET,
        url: localmileChecSubCustomerExistsURL,
        headers: apiHeaders
      });

      log.debug({
        title: "responseChecSubCustomerExists",
        details: responseChecSubCustomerExists
      });

      var myresponseChecSubCustomerExists_body =
        responseChecSubCustomerExists.body;
      var myresponseChecSubCustomerExists_code =
        responseChecSubCustomerExists.code;

      log.debug({
        title: "myresponseChecSubCustomerExists_body",
        details: myresponseChecSubCustomerExists_body
      });

      log.debug({
        title: "myresponseChecSubCustomerExists_code",
        details: myresponseChecSubCustomerExists_code
      });

      // var firebaseLeadURL =
      //   "https://firestore.googleapis.com/v1/projects/localmile-plus/databases/(default)/documents/companies/" +
      //   parentIMInternalId +
      //   "/customers/" +
      //   customerInternalId;

      // var apiHeaders = {};
      // apiHeaders["Content-Type"] = "application/json";
      // apiHeaders["Accept"] = "*/*";
      // apiHeaders["Authorization"] = "Bearer " + idToken;

      // var responseLeadDocument = https.request({
      //   method: https.Method.GET,
      //   url: firebaseLeadURL,
      //   headers: apiHeaders
      // });

      // var dbBody = responseLeadDocument.body;

      // log.audit({
      //   title: "Lead Firebase Data",
      //   details: dbBody
      // });

      // var responseObj = JSON.parse(dbBody);

      //Check if fields exist
      if (myresponseChecSubCustomerExists_code == 200) {
        var parsedBody = JSON.parse(myresponseChecSubCustomerExists_body);
        if (parsedBody.exists == true) {
          log.audit({
            title:
              "Lead " +
              customerInternalId +
              "exists in IM" +
              parentIMInternalId +
              " in Firebase and will be updated",
            details: ""
          });

          var localmileUpdateSubCustomerURL =
            "https://localmile-plus.web.app/api/v1/companies/" +
            parentIMInternalId +
            "/customers/" +
            customerInternalId;

          var apiHeaders = {};
          apiHeaders["Content-Type"] = "application/json";
          apiHeaders["x-api-key"] =
            "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

          var responseUpdateSubCustomer = https.request({
            method: https.Method.PUT,
            url: localmileUpdateSubCustomerURL,
            body: JSON.stringify(customerDetails),
            headers: apiHeaders
          });

          log.debug({
            title: "responseUpdateSubCustomer",
            details: responseUpdateSubCustomer
          });

          var myresponseUpdateSubCustomer_body = responseUpdateSubCustomer.body;
          var myresponseUpdateSubCustomer_code = responseUpdateSubCustomer.code;

          //Update Lead Record in Firebase
          // var firebaseUpdateLeadsURL =
          //   "https://firestore.googleapis.com/v1/projects/localmile-plus/databases/(default)/documents/companies/" +
          //   parentIMInternalId +
          //   "/customers/" +
          //   customerInternalId +
          //   "?updateMask.fieldPaths=franchisee&updateMask.fieldPaths=franchiseeText&updateMask.fieldPaths=franchiseeTerritoryJSON&updateMask.fieldPaths=linkedZeeDetails";

          // log.debug({
          //   title: "firebaseUpdateLeadsURL",
          //   details: firebaseUpdateLeadsURL
          // });

          // var apiHeaders = {};
          // apiHeaders["Content-Type"] = "application/json";
          // apiHeaders["Accept"] = "*/*";
          // apiHeaders["X-HTTP-Method-Override"] = "PATCH";

          // var response = https.request({
          //   method: https.Method.POST,
          //   url: firebaseUpdateLeadsURL,
          //   body: customerDetails,
          //   headers: apiHeaders
          // });

          // var myresponse_body = response.body;
          // var myresponse_code = response.code;

          // log.debug({
          //   title: "myresponse_body",
          //   details: myresponse_body
          // });

          // log.debug({
          //   title: "myresponse_code",
          //   details: myresponse_code
          // });

          var returnObj = {
            success: true,
            message: "",
            result: "Lead Resynced to Firebase Successfully"
          };

          log.audit({
            title:
              "Lead " +
              customerInternalId +
              " Resynced to Firebase Successfully",
            details: returnObj
          });
        } else {
          log.audit({
            title:
              "Lead " +
              customerInternalId +
              " Record Does Not Exist in Firebase for Parent IM " +
              parentIMInternalId,
            details: ""
          });

          var localmileUpdateSubCustomerURL =
            "https://localmile-plus.web.app/api/v1/companies/" +
            parentIMInternalId +
            "/customers/" +
            customerInternalId;

          log.debug({
            title: "localmileUpdateSubCustomerURL",
            details: localmileUpdateSubCustomerURL
          });

          var apiHeaders = {};
          apiHeaders["Content-Type"] = "application/json";
          apiHeaders["x-api-key"] =
            "f7d8c2e1b0a943ef8215d6c7b8a90123fe456789abcd0123456789abcdef0123";

          log.debug({
            title: "customerDetails",
            details: customerDetails
          });

          var responseUpdateSubCustomer = https.request({
            method: https.Method.PUT,
            url: localmileUpdateSubCustomerURL,
            body: JSON.stringify(customerDetails),
            headers: apiHeaders
          });

          log.debug({
            title: "responseUpdateSubCustomer",
            details: responseUpdateSubCustomer
          });

          var myresponseUpdateSubCustomer_body = responseUpdateSubCustomer.body;
          var myresponseUpdateSubCustomer_code = responseUpdateSubCustomer.code;

          if (myresponseUpdateSubCustomer_code !== 200) {
            var returnObj = {
              success: false,
              message: "",
              result: "Lead Does Not Exist in Firebase"
            };
          } else if (myresponseUpdateSubCustomer_code == 200) {
            var returnObj = {
              success: true,
              message: "",
              result: "Lead Resynced to Firebase Successfully"
            };
          }
        }
      }

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
   * @description Check if a suburb, state, and postcode combination exists in a JSON array.
   * @author Ankith Ravindran (AR)
   * @date 28/09/2025
   * @param {*} jsonArray
   * @param {*} suburb
   * @param {*} state
   * @param {*} postcode
   * @returns {*}
   */
  function suburbStatePostcodeExists(jsonArray, suburb, state, postcode) {
    log.audit({
      title: "suburbStatePostcodeExists",
      details: {
        suburb: suburb,
        state: state,
        postcode: postcode,
        jsonArray: jsonArray
      }
    });
    for (var i = 0; i < jsonArray.length; i++) {
      if (
        jsonArray[i].suburbs === suburb.toUpperCase() &&
        jsonArray[i].state === state &&
        jsonArray[i].post_code === postcode
      ) {
        return true;
      }
    }
    return false;
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
